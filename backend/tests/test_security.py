from test_workflow import client
from app.main import app
from app.db import get_session
from app import db as database

def test_owner_login_protects_workspace_and_revokes_logout(client, monkeypatch):
    generator = app.dependency_overrides[get_session]()
    db = next(generator)
    monkeypatch.setattr(database, 'engine', db.get_bind())
    monkeypatch.setenv('AUTH_REQUIRED', '1')
    credentials = {'username':'owner', 'password':'My long test password 123!'}
    assert client.get('/api/series').status_code == 401
    assert client.get('/api/auth/status').json()['setup_required']
    assert client.post('/api/auth/setup', json=credentials, headers={'Origin':'https://untrusted.example'}).status_code == 403
    r = client.post('/api/auth/setup', json=credentials)
    assert r.status_code == 200
    assert 'HttpOnly' in r.headers['set-cookie'] and 'SameSite=strict' in r.headers['set-cookie']
    assert client.get('/api/series').status_code == 200
    assert client.post('/api/auth/setup', json=credentials).status_code == 409
    assert client.post('/api/auth/logout').status_code == 200
    assert client.get('/api/series').status_code == 401
    assert client.post('/api/auth/login', json={**credentials,'password':'Wrong long password'}).status_code == 401
    assert client.post('/api/auth/login', json=credentials).status_code == 200
    assert client.get('/api/production/jobs').status_code == 200
    assert client.post('/api/production/jobs', json={'episode_id':1},headers={'Origin':'https://untrusted.example'}).status_code == 403
    generator.close()

def test_remote_setup_token_and_login_lockout(client, monkeypatch):
    generator = app.dependency_overrides[get_session]()
    db = next(generator)
    monkeypatch.setattr(database, 'engine', db.get_bind())
    monkeypatch.setenv('AUTH_REQUIRED','1')
    monkeypatch.setenv('OWNER_SETUP_TOKEN','server-configured-secret')
    credentials={'username':'owner', 'password':'Another long password 123!'}
    assert client.post('/api/auth/setup',json=credentials).status_code == 403
    assert client.post('/api/auth/setup',json=credentials,headers={'X-Setup-Token':'server-configured-secret'}).status_code == 200
    client.post('/api/auth/logout')
    for _ in range(5):
        assert client.post('/api/auth/login',json={**credentials,'password':'Wrong long password 123!'}).status_code == 401
    assert client.post('/api/auth/login',json=credentials).status_code == 429
    generator.close()
