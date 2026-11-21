import json
from datetime import date, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import httpx
import pytest
from cryptography.fernet import Fernet
from sqlmodel import select
from test_workflow import client, schedule
from app.main import app
from app.db import get_session
from app import connections, production, publishing
from app.channels import configure_from_file
from app.models import ProviderConnection, ProductionJob, ScheduledRelease, Episode, utcnow

def test_daily_slots_and_utc_conversion_keep_india_wall_time():
    from datetime import datetime
    from app.models import as_utc
    from app.scheduler import IST
    now=datetime(2026,11,17,15,0,tzinfo=IST)
    assert publishing.next_slot({'publish_time':'16:00'},now) == datetime(2026,11,17,10,30,tzinfo=timezone.utc)
    assert publishing.next_slot({'publish_time':'19:00'},now) == datetime(2026,11,17,13,30,tzinfo=timezone.utc)
    assert as_utc(datetime(2026,11,17,16,0,tzinfo=IST)).hour == 10

@pytest.fixture
def workspace(client, monkeypatch, tmp_path):
    generator=app.dependency_overrides[get_session]()
    db=next(generator)
    profiles=configure_from_file(Path(__file__).resolve().parents[2]/'config/channels.json',db,date(2026,11,17))
    monkeypatch.setattr(production,'MEDIA',tmp_path)
    episode=schedule(client,profiles[0]['series_id'])
    client.post(f"/api/episodes/{episode['id']}/generate")
    saved=db.get(Episode,episode['id'])
    saved.generation_mode='openai'
    db.add(saved)
    job=ProductionJob(episode_id=saved.id,status='completed',story_snapshot=saved.story)
    db.add(job)
    db.commit()
    db.refresh(job)
    folder=tmp_path/str(job.id)
    folder.mkdir()
    (folder/'episode.mp4').write_bytes(b'fixture reviewed video')
    from PIL import Image
    from app.models import ThumbnailAsset
    from app.thumbnails import digest
    Image.new('RGB',(1280,720),'purple').save(folder/'thumbnail.jpg')
    db.add(ThumbnailAsset(job_id=job.id,digest=digest(folder/'thumbnail.jpg')));db.commit()
    yield SimpleNamespace(db=db,bind=db.get_bind(),profiles=profiles,job=job,episode=saved,client=client)
    generator.close()

def create_release(w,**overrides):
    body=dict(job_id=w.job.id,channel_key=w.profiles[0]['key'],title='Tamil technical lesson',caption='Reviewed Tamil caption',made_for_kids=False,publish_at=(utcnow()+timedelta(hours=1)).isoformat())
    body.update(overrides)
    return w.client.post('/api/publishing/releases',json=body)

def connect_fixture(w,monkeypatch):
    monkeypatch.setenv('TOKEN_ENCRYPTION_KEY',Fernet.generate_key().decode())
    monkeypatch.setenv('PUBLIC_API_URL','https://studio.example.com')
    monkeypatch.setenv('MEDIA_SIGNING_KEY','fixture-signing-key')
    for provider in ['google','instagram']:
        tokens=connections.cipher().encrypt(json.dumps({'access_token':'fixture-only-token'}).encode()).decode()
        w.db.add(ProviderConnection(channel_key=w.profiles[0]['key'],provider=provider,account_id='account',account_label='Fixture account',encrypted_tokens=tokens,expires_at=utcnow()+timedelta(days=30)))
    w.db.commit()
    monkeypatch.setattr(publishing,'upload_youtube_thumbnail',lambda *args:'uploaded')

def test_review_binding_missed_approval_and_channel_protection(workspace):
    w=workspace
    assert create_release(w,channel_key=w.profiles[1]['key']).status_code == 422
    release=create_release(w).json()
    assert release['status'] == 'pending_review'
    assert create_release(w).status_code == 409
    assert w.client.post(f"/api/publishing/releases/{release['id']}/approve",json={'reviewed_video_and_metadata':False}).status_code == 422
    publishing.publishing_tick(w.bind,now=utcnow()+timedelta(hours=2))
    assert w.client.get('/api/publishing/releases').json()[0]['status'] == 'held'
    assert w.client.post(f"/api/publishing/releases/{release['id']}/approve",json={'reviewed_video_and_metadata':True}).status_code == 409
    assert w.client.post(f"/api/publishing/releases/{release['id']}/cancel").status_code == 200
    assert create_release(w).status_code == 201

def test_approval_rejects_changed_video_and_demo(workspace):
    w=workspace
    release=create_release(w).json()
    w.episode.generation_mode='demo'
    w.db.add(w.episode);w.db.commit()
    url=f"/api/publishing/releases/{release['id']}/approve"
    assert w.client.post(url,json={'reviewed_video_and_metadata':True}).status_code == 422
    w.episode.generation_mode='openai'
    w.db.add(w.episode);w.db.commit()
    publishing.video_path(w.job.id).write_bytes(b'changed file')
    assert w.client.post(url,json={'reviewed_video_and_metadata':True}).status_code == 409

def test_approved_due_release_posts_each_platform_once(workspace,monkeypatch):
    w=workspace
    connect_fixture(w,monkeypatch)
    monkeypatch.setenv('AUTOMATED_PUBLISHING','1')
    youtube=Mock(return_value={'id':'yt-id','status':'published'})
    instagram=Mock(return_value={'id':'ig-id','status':'published'})
    monkeypatch.setattr(publishing,'upload_youtube',youtube)
    monkeypatch.setattr(publishing,'upload_instagram',instagram)
    release=create_release(w).json()
    assert w.client.post(f"/api/publishing/releases/{release['id']}/approve",json={'reviewed_video_and_metadata':True}).status_code == 200
    due=utcnow()+timedelta(hours=1,minutes=1)
    publishing.publishing_tick(w.bind,now=due)
    publishing.publishing_tick(w.bind,now=due)
    result=w.client.get('/api/publishing/releases').json()[0]
    assert result['status'] == 'published'
    assert result['platform_results']['YouTube']['id'] == 'yt-id'
    assert youtube.call_count == instagram.call_count == 1

def test_interrupted_second_platform_never_automatically_reposts(workspace,monkeypatch):
    w=workspace
    connect_fixture(w,monkeypatch)
    monkeypatch.setenv('AUTOMATED_PUBLISHING','1')
    youtube=Mock(return_value={'id':'already-uploaded','status':'published'})
    instagram=Mock(side_effect=httpx.ReadTimeout('private provider detail'))
    monkeypatch.setattr(publishing,'upload_youtube',youtube)
    monkeypatch.setattr(publishing,'upload_instagram',instagram)
    release=create_release(w).json()
    w.client.post(f"/api/publishing/releases/{release['id']}/approve",json={'reviewed_video_and_metadata':True})
    publishing.publishing_tick(w.bind,now=utcnow()+timedelta(hours=1,minutes=1))
    publishing.publishing_tick(w.bind,now=utcnow()+timedelta(hours=1,minutes=2))
    result=w.client.get('/api/publishing/releases').json()[0]
    assert result['status'] == 'needs_reconciliation'
    assert result['platform_results']['YouTube']['id'] == 'already-uploaded'
    assert 'private provider detail' not in result['error']
    assert youtube.call_count == instagram.call_count == 1

def test_calendar_exact_reminder_idempotent_event_and_cancellation(workspace,monkeypatch):
    w=workspace
    connect_fixture(w,monkeypatch)
    release=create_release(w).json()
    row=w.db.get(ScheduledRelease,release['id'])
    calls=[]
    class Client:
        def __init__(self,**kwargs):pass
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def put(self,url,**kwargs):
            calls.append(('put',url,kwargs));return httpx.Response(404)
        def post(self,url,**kwargs):
            calls.append(('post',url,kwargs));return httpx.Response(200,json={'id':'event'})
        def delete(self,url,**kwargs):
            calls.append(('delete',url,kwargs));return httpx.Response(204)
    monkeypatch.setattr(publishing.httpx,'Client',Client)
    publishing.sync_calendar(row,w.db)
    assert row.calendar_status == 'synced'
    payload=calls[1][2]['json']
    assert payload['reminders'] == {'useDefault':False,'overrides':[{'method':'popup','minutes':15}]}
    assert payload['start']['timeZone'] == 'Asia/Kolkata'
    publishing.sync_calendar(row,w.db)
    assert calls[3][2]['json']['id'] == payload['id']
    row.status='cancelled'
    publishing.sync_calendar(row,w.db)
    assert row.calendar_status == 'cancelled' and calls[-1][0] == 'delete'

def test_signed_media_protects_files(workspace,monkeypatch):
    from urllib.parse import urlparse
    w=workspace
    connect_fixture(w,monkeypatch)
    release=create_release(w).json()
    row=w.db.get(ScheduledRelease,release['id'])
    row.status='publishing';w.db.add(row);w.db.commit()
    parsed=urlparse(publishing.signed_media_url(row))
    assert w.client.get(parsed.path+'?'+parsed.query).status_code == 200
    assert w.client.get(parsed.path+'?expires=1&signature=wrong').status_code == 403
    assert w.client.get(parsed.path+'?'+parsed.query.replace('signature=','signature=wrong')).status_code == 403

def test_oauth_state_one_use_encrypted_storage_and_safe_status(workspace,monkeypatch):
    from urllib.parse import urlparse,parse_qs
    w=workspace
    connect_fixture(w,monkeypatch)
    monkeypatch.setenv('GOOGLE_CLIENT_ID','fixture-client')
    monkeypatch.setenv('GOOGLE_CLIENT_SECRET','fixture-client-secret')
    response=w.client.post(f"/api/connections/{w.profiles[0]['key']}/google/authorize")
    assert response.status_code == 200
    params=parse_qs(urlparse(response.json()['authorization_url']).query)
    assert params['code_challenge_method'] == ['S256']
    state=params['state'][0]
    monkeypatch.setattr(connections,'exchange',lambda *args:({'access_token':'fixture-secret-access','refresh_token':'fixture-refresh','expires_in':3600},'account-id','Verified channel'))
    result=w.client.get('/api/connections/oauth/google/callback',params={'state':state,'code':'fixture-code'},follow_redirects=False)
    assert result.status_code == 303
    assert w.client.get('/api/connections/oauth/google/callback',params={'state':state,'code':'fixture-code'}).status_code == 400
    stored=connections.find_connection(w.profiles[0]['key'],'google',w.db)
    w.db.refresh(stored)
    assert 'fixture-secret-access' not in stored.encrypted_tokens
    assert 'fixture-secret-access' not in w.client.get('/api/connections/status').text
    assert 'fixture-client-secret' not in w.client.get('/api/connections/status').text

def test_missing_account_blocks_both_platforms_before_any_upload(workspace,monkeypatch):
    w=workspace
    monkeypatch.setenv('AUTOMATED_PUBLISHING','1')
    upload=Mock()
    monkeypatch.setattr(publishing,'upload_youtube',upload)
    release=create_release(w).json()
    w.client.post(f"/api/publishing/releases/{release['id']}/approve",json={'reviewed_video_and_metadata':True})
    publishing.publishing_tick(w.bind,now=utcnow()+timedelta(hours=1,minutes=1))
    assert w.client.get('/api/publishing/releases').json()[0]['status'] == 'blocked'
    upload.assert_not_called()

def test_youtube_resumable_empty_initial_response_and_private_receipt(workspace,monkeypatch):
    w=workspace
    release=create_release(w).json()
    row=w.db.get(ScheduledRelease,release['id'])
    requests=[]
    real_client=httpx.Client
    def handler(request):
        requests.append(request)
        if request.method == 'POST':
            assert json.loads(request.content)['status']['selfDeclaredMadeForKids'] is False
            return httpx.Response(200,headers={'Location':'https://www.googleapis.com/upload/session/fixture'})
        assert request.content == b'fixture reviewed video'
        return httpx.Response(200,json={'id':'video','status':{'privacyStatus':'private'}})
    monkeypatch.setattr(publishing.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    result=publishing.upload_youtube(row,'fixture-only-token')
    assert result == {'id':'video','status':'uploaded_private'}
    assert len(requests) == 2

def test_instagram_container_processing_then_publish(workspace,monkeypatch):
    w=workspace
    connect_fixture(w,monkeypatch)
    release=create_release(w).json()
    row=w.db.get(ScheduledRelease,release['id'])
    connection=connections.find_connection(row.channel_key,'instagram',w.db)
    real_client=httpx.Client
    calls=[]
    def handler(request):
        calls.append(request)
        if request.url.path.endswith('/media'):
            body=json.loads(request.content)
            assert body['media_type'] == 'REELS' and 'signature=' in body['video_url']
            return httpx.Response(200,json={'id':'container'})
        if request.method == 'GET':
            return httpx.Response(200,json={'status_code':'FINISHED'})
        assert json.loads(request.content)['creation_id'] == 'container'
        return httpx.Response(200,json={'id':'instagram-reel'})
    monkeypatch.setattr(publishing.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    assert publishing.upload_instagram(row,connection,'fixture-token') == {'id':'instagram-reel','status':'published'}
    assert len(calls) == 3

def test_google_oauth_rejects_wrong_channel(workspace,monkeypatch):
    w=workspace
    connect_fixture(w,monkeypatch)
    monkeypatch.setenv('GOOGLE_CLIENT_ID','fixture-client')
    monkeypatch.setenv('GOOGLE_CLIENT_SECRET','fixture-secret')
    real_client=httpx.Client
    def handler(request):
        if request.method == 'POST':
            return httpx.Response(200,json={'access_token':'fixture-token','refresh_token':'fixture-refresh','scope':connections.GOOGLE_SCOPES})
        return httpx.Response(200,json={'items':[{'id':'wrong','snippet':{'customUrl':'@UnrelatedChannel','title':'Wrong channel'}}]})
    monkeypatch.setattr(connections.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        connections.exchange('google','fixture-code','fixture-verifier',w.profiles[0])
    assert error.value.status_code == 422
