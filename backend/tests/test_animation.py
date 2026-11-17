from datetime import timedelta
from pathlib import Path
from shutil import copyfile
import subprocess
from uuid import UUID
import httpx
import imageio_ffmpeg
import pytest
from sqlmodel import select
from test_workflow import client, make_series, schedule
from app.main import app
from app.db import get_session
from app.models import Episode, AnimationClip, AnimationPlan, ProductionJob
from app import animation, production

@pytest.fixture
def animated_workspace(client,monkeypatch,tmp_path):
    generator=app.dependency_overrides[get_session]()
    db=next(generator)
    episode=schedule(client,make_series(client))
    story=client.post(f"/api/episodes/{episode['id']}/generate").json()['story']
    story['scenes']=story['scenes'][:3]
    for scene in story['scenes']:
        scene['duration_seconds']=2
    client.put(f"/api/episodes/{episode['id']}/story",json=story)
    item=db.get(Episode,episode['id']);item.generation_mode='openai';db.add(item);db.commit()
    monkeypatch.setattr(production,'MEDIA',tmp_path)
    monkeypatch.setenv('RUNWAYML_API_SECRET','fixture-provider-key')
    yield client,db,episode['id'],tmp_path
    generator.close()

def queue(w,**changes):
    client,db,episode_id,folder=w
    body={'episode_id':episode_id,'renderer':'animated','paid_generation_approved':True}
    body.update(changes)
    return client.post('/api/production/jobs',json=body)

def test_paid_generation_requires_consent_credentials_and_real_script(animated_workspace,monkeypatch):
    w=animated_workspace
    assert queue(w,paid_generation_approved=False).status_code == 422
    monkeypatch.delenv('RUNWAYML_API_SECRET')
    assert queue(w).status_code == 422
    monkeypatch.setenv('RUNWAYML_API_SECRET','fixture-key')
    item=w[1].get(Episode,w[2]);item.generation_mode='demo';w[1].add(item);w[1].commit()
    assert queue(w).status_code == 422
    assert w[0].get('/api/production/jobs').json() == []

def test_duration_splitting_prompt_limits_and_output_security():
    assert animation.split_duration(15) == [8,7]
    assert animation.split_duration(11) == [6,5]
    assert animation.split_duration(8) == [8]
    assert len(animation.bounded_prompt('😀'*1000).encode('utf-16-le')) <= 2000
    for url in ['http://cdn.runwayml.com/video','https://127.0.0.1/video','https://runwayml.com.evil.example/video','https://cdn.runwayml.com:444/video']:
        with pytest.raises(animation.AnimationError):
            animation.allowed_output(url)
    animation.allowed_output('https://cdn.runwayml.com/video')

def test_real_clip_assembly_and_frame_continuity_with_mocked_provider(animated_workspace,monkeypatch):
    w=animated_workspace
    client,db,_,folder=w
    queued=queue(w).json()
    assert queued['renderer'] == 'animated' and len(queued['clips']) == 3
    source=folder/'moving-test.mp4'
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg,'-y','-loglevel','error','-f','lavfi','-i','testsrc2=size=180x320:rate=24:duration=2',
        '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',str(source)],check=True,capture_output=True,timeout=60)
    real_client=httpx.Client
    submissions=[]
    def handler(request):
        import json
        assert request.headers['Authorization'] == 'Bearer fixture-provider-key'
        assert request.headers['X-Runway-Version'] == '2024-11-06'
        if request.method == 'POST':
            body=json.loads(request.content)
            submissions.append((request.url.path,body))
            return httpx.Response(200,json={'id':str(UUID(int=len(submissions)))})
        return httpx.Response(200,json={'status':'SUCCEEDED','output':['https://cdn.runwayml.com/fixture.mp4']})
    monkeypatch.setattr(animation.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    monkeypatch.setattr(animation,'download_clip',lambda url,path:copyfile(source,path))
    assert production.process_one(db.get_bind())
    result=client.get('/api/production/jobs').json()[0]
    assert result['status'] == 'completed'
    assert all(c['state'] == 'downloaded' for c in result['clips'])
    assert submissions[0][0].endswith('text_to_video')
    assert all(p.endswith('image_to_video') and b['promptImage'].startswith('data:image/jpeg;base64,') for p,b in submissions[1:])
    output=folder/str(queued['id'])/'episode.mp4'
    assert output.is_file() and b'ftyp' in output.read_bytes()[:32]
    frames=subprocess.run([ffmpeg,'-loglevel','error','-i',str(output),'-vf',"select='not(mod(n,24))'",'-f','framemd5','-'],capture_output=True,check=True,timeout=60).stdout
    hashes=[line.split(b',')[-1].strip() for line in frames.splitlines() if line and not line.startswith(b'#')]
    assert len(set(hashes)) > 1, 'Output must contain changing video frames'
    assert client.get(f"/api/production/jobs/{queued['id']}/video").status_code == 200
    captions=client.get(f"/api/production/jobs/{queued['id']}/captions.vtt")
    assert captions.status_code == 200 and captions.text.startswith('WEBVTT')
    assert '00:00:00.000 --> 00:00:02.000' in captions.text
    assert '00:00:04.000 --> 00:00:06.000' in captions.text
    assert '00:00:00,000' in client.get(f"/api/production/jobs/{queued['id']}/captions.srt").text
    # Assembly retries reuse every cached scene and must not create provider tasks.
    job=db.get(ProductionJob,queued['id']);job.status='failed';db.add(job);db.commit()
    client.post(f"/api/production/jobs/{queued['id']}/retry")
    assert production.process_one(db.get_bind())
    assert len(submissions) == 3

def test_uncertain_submission_never_bills_again_without_task_recovery(animated_workspace,monkeypatch):
    w=animated_workspace
    client,db,_,folder=w
    job=queue(w).json()
    real_client=httpx.Client
    attempts=[]
    def timeout(request):
        attempts.append(request)
        raise httpx.ReadTimeout('fixture private token must not appear')
    monkeypatch.setattr(animation.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(timeout),**kwargs))
    production.process_one(db.get_bind())
    failed=client.get('/api/production/jobs').json()[0]
    assert failed['status'] == 'failed' and failed['clips'][0]['state'] == 'uncertain'
    assert 'fixture private token' not in failed['error']
    assert client.post(f"/api/production/jobs/{job['id']}/retry").status_code == 409
    assert len(attempts) == 1
    task=str(UUID(int=123))
    monkeypatch.setattr(animation.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(lambda r:httpx.Response(200,json={'id':task,'status':'RUNNING'})),**kwargs))
    recovered=client.post(f"/api/production/jobs/{job['id']}/recover-task",json={'clip_id':failed['clips'][0]['id'],'task_id':task})
    assert recovered.status_code == 200
    assert client.post(f"/api/production/jobs/{job['id']}/retry").status_code == 200
    restored=client.get('/api/production/jobs').json()[0]
    assert restored['clips'][0]['task_id'] == task

def test_failed_provider_task_needs_new_charge_consent(animated_workspace,monkeypatch):
    client,db,_,folder=animated_workspace
    job=queue(animated_workspace).json()
    row=db.get(ProductionJob,job['id']);row.status='failed';db.add(row)
    clip=db.exec(select(AnimationClip).where(AnimationClip.job_id == row.id)).first()
    clip.state='provider_failed';clip.task_id=str(UUID(int=7));db.add(clip);db.commit()
    assert client.post(f"/api/production/jobs/{row.id}/retry").status_code == 422
    assert client.post(f"/api/production/jobs/{row.id}/retry",json={'regenerate_failed':True}).status_code == 200
    db.refresh(clip)
    assert clip.state == 'pending' and clip.task_id is None

def test_interrupted_speech_requires_explicit_new_charge_consent(animated_workspace):
    client,db,_,folder=animated_workspace
    job=queue(animated_workspace).json()
    row=db.get(ProductionJob,job['id']);row.status='failed';db.add(row);db.commit()
    marker=folder/str(row.id)/'narration-0.requested'
    marker.parent.mkdir();marker.touch()
    assert client.post(f"/api/production/jobs/{row.id}/retry").status_code == 422
    assert marker.exists()
    assert client.post(f"/api/production/jobs/{row.id}/retry",json={'retry_speech':True}).status_code == 200
    assert not marker.exists()

def test_download_never_sends_provider_key_to_cdn(monkeypatch,tmp_path):
    real_client=httpx.Client
    def handler(request):
        assert 'Authorization' not in request.headers
        assert request.url.host == 'cdn.runwayml.com'
        return httpx.Response(200,content=b'fixture-video-data'*8)
    monkeypatch.setattr(animation.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    target=tmp_path/'download.mp4'
    animation.download_clip('https://cdn.runwayml.com/fixture',target)
    assert target.is_file() and not target.with_suffix('.download').exists()

def test_audio_probe_measures_track_length(tmp_path):
    from app.media_probe import audio_duration
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    audio=tmp_path/'voice.wav'
    subprocess.run([ffmpeg,'-y','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=2.5',str(audio)],check=True,capture_output=True,timeout=30)
    assert abs(audio_duration(ffmpeg,audio)-2.5) < .05
