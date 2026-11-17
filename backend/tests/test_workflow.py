import os
os.environ['GENERATION_MODE'] = 'demo'
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine
from app.db import get_session
from app.main import app

@pytest.fixture
def client():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    def session():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_session] = session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    engine.dispose()

def make_series(client):
    r = client.post('/api/series', json={'name':'ZENBEE', 'visual_style':'Pastel 3D', 'characters':'Zee: yellow bee with teal glasses'})
    assert r.status_code == 201
    return r.json()['id']

def schedule(client, series_id):
    publish = datetime.now(timezone.utc)+timedelta(days=3)
    r = client.post('/api/episodes', json={'series_id':series_id, 'topic':'The rainbow flower', 'publish_at':publish.isoformat(), 'lead_hours':24})
    assert r.status_code == 201
    result = r.json()
    assert datetime.fromisoformat(result['publish_at'].replace('Z','+00:00'))-datetime.fromisoformat(result['generate_at'].replace('Z','+00:00')) == timedelta(hours=24)
    return result

def test_topic_to_prompt_persists_and_prevents_duplicate_generation(client):
    episode = schedule(client, make_series(client))
    result = client.post(f"/api/episodes/{episode['id']}/generate")
    assert result.status_code == 200
    data = result.json()
    assert data['status'] == 'script_ready'
    assert data['generation_mode'] == 'demo'
    assert len(data['story']['scenes']) == 4
    assert 'teal glasses' in data['story']['scenes'][0]['visual_prompt']
    assert client.get('/api/episodes').json()[0]['story'] == data['story']
    assert client.post(f"/api/episodes/{episode['id']}/generate").status_code == 409

def test_failed_job_can_retry(client):
    episode = schedule(client, make_series(client))
    with patch('app.main.generate_story', side_effect=RuntimeError('private provider diagnostic')):
        failed = client.post(f"/api/episodes/{episode['id']}/generate").json()
    assert failed['status'] == 'failed'
    assert 'private' not in failed['error']
    retried = client.post(f"/api/episodes/{episode['id']}/generate").json()
    assert retried['status'] == 'script_ready'
    assert retried['attempts'] == 2
    assert retried['error'] is None

def test_schedule_validation(client):
    sid = make_series(client)
    payload = {'series_id':sid,'topic':'Hello','publish_at':'2020-01-01T10:00:00+05:30'}
    assert client.post('/api/episodes',json=payload).status_code == 422
    payload['publish_at'] = '2099-01-01T10:00:00'
    assert client.post('/api/episodes',json=payload).status_code == 422
    payload['publish_at'] = '2099-01-01T10:00:00+05:30'
    payload['series_id'] = 999
    assert client.post('/api/episodes',json=payload).status_code == 404

def test_series_memory_is_scoped(client):
    sid = make_series(client)
    first = schedule(client, sid)
    client.post(f"/api/episodes/{first['id']}/generate")
    second = schedule(client, sid)
    data = client.post(f"/api/episodes/{second['id']}/generate").json()
    assert 'Previous story count: 1' in data['story']['continuity_notes']
    other = schedule(client, make_series(client))
    data = client.post(f"/api/episodes/{other['id']}/generate").json()
    assert 'Previous story count: 0' in data['story']['continuity_notes']
