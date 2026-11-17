from test_workflow import client, make_series, schedule

def test_local_preview_origins_can_save_edits(client):
    for origin in ['http://localhost:3000', 'http://127.0.0.1:3000']:
        result = client.options('/api/series/1', headers={
            'Origin': origin, 'Access-Control-Request-Method': 'PUT',
            'Access-Control-Request-Headers': 'content-type'})
        assert result.status_code == 200
        assert result.headers['access-control-allow-origin'] == origin
    denied = client.options('/api/series/1', headers={
        'Origin': 'https://unrelated.example', 'Access-Control-Request-Method': 'PUT'})
    assert denied.status_code == 400

def test_series_memory_update_is_saved(client):
    sid = make_series(client)
    result = client.put(f'/api/series/{sid}', json={
        'name': 'ZENBEE', 'visual_style': 'Pastel 3D',
        'characters': 'Zee: yellow bee with teal glasses',
        'description': 'Magic is only possible inside the sketchbook.'})
    assert result.status_code == 200
    assert 'sketchbook' in client.get('/api/series').json()[0]['description']
    assert client.put('/api/series/999', json={
        'name':'Missing','visual_style':'3D','characters':'Zee'}).status_code == 404

def test_scene_edits_persist_and_validate_duration(client):
    episode = schedule(client, make_series(client))
    eid = episode['id']
    assert client.put(f'/api/episodes/{eid}/story', json={}).status_code == 409
    story = client.post(f'/api/episodes/{eid}/generate').json()['story']
    story['scenes'][0]['dialogue'] = 'Zee: A new adventure begins!'
    result = client.put(f'/api/episodes/{eid}/story', json=story)
    assert result.status_code == 200
    assert client.get('/api/episodes').json()[0]['story']['scenes'][0]['dialogue'] == story['scenes'][0]['dialogue']
    story['scenes'] = [dict(story['scenes'][0], number=i+1, duration_seconds=15) for i in range(5)]
    assert client.put(f'/api/episodes/{eid}/story', json=story).status_code == 422
    assert client.put(f'/api/episodes/{eid}/story', json={'title':'Incomplete'}).status_code == 422
