from datetime import timedelta
from pathlib import Path
from sqlmodel import Session, select
from test_workflow import client, make_series
from app.models import ProductionJob, utcnow
from app import production

def ready(client):
    series = make_series(client)
    episode = client.post('/api/episodes', json={'series_id':series, 'topic':'A friendly panda',
        'publish_at':(utcnow()+timedelta(days=3)).isoformat(), 'lead_hours':24}).json()
    return client.post(f"/api/episodes/{episode['id']}/generate").json()

def test_queue_duplicate_retry_and_missing_media(client, monkeypatch):
    episode = ready(client)
    response = client.post('/api/production/jobs', json={'episode_id':episode['id']})
    assert response.status_code == 201
    job = response.json()
    assert job['story_snapshot'] == episode['story']
    assert client.post('/api/production/jobs', json={'episode_id':episode['id']}).status_code == 409
    assert client.post(f"/api/production/jobs/{job['id']}/retry").status_code == 409
    assert client.get(f"/api/production/jobs/{job['id']}/video").status_code == 404
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    assert client.post('/api/production/jobs', json={'episode_id':episode['id'], 'voice':True}).status_code == 422

def test_actual_mp4_render_and_worker_failure(client, monkeypatch, tmp_path):
    episode = ready(client)
    queued = client.post('/api/production/jobs', json={'episode_id':episode['id']}).json()
    from app.main import app
    from app.db import get_session
    session_generator = app.dependency_overrides[get_session]()
    db = next(session_generator)
    bind = db.get_bind()
    monkeypatch.setattr(production, 'MEDIA', tmp_path)
    assert production.process_one(bind)
    result = client.get('/api/production/jobs').json()[0]
    assert result['status'] == 'completed'
    video = client.get(f"/api/production/jobs/{queued['id']}/video")
    assert video.status_code == 200 and video.headers['content-type'] == 'video/mp4'
    assert b'ftyp' in video.content[:32] and len(video.content) > 1000
    client.post('/api/production/jobs', json={'episode_id':episode['id']})
    def fail(job):
        raise RuntimeError('private provider detail')
    monkeypatch.setattr(production, 'render', fail)
    assert production.process_one(bind)
    failed = client.get('/api/production/jobs').json()[0]
    assert failed['status'] == 'failed' and 'private' not in failed['error']
    assert client.post(f"/api/production/jobs/{failed['id']}/retry").status_code == 200
    session_generator.close()
