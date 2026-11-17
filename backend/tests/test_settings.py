from test_workflow import client, make_series, schedule

def test_settings_defaults_validation_and_audit(client):
    defaults = client.get('/api/settings/system').json()['data']
    assert defaults['timezone'] == 'Asia/Kolkata'
    defaults['workspace_name'] = 'My ZENBEE Studio'
    defaults['generation_lead_hours'] = 48
    assert client.put('/api/settings/system',json=defaults).status_code == 200
    assert client.get('/api/settings/system').json()['data']['workspace_name'] == 'My ZENBEE Studio'
    defaults['timezone'] = 'UTC'
    assert client.put('/api/settings/system',json=defaults).status_code == 422
    assert client.put('/api/settings/providers',json={'api_key':'must-never-be-stored'}).status_code == 422
    assert client.get('/api/studio/events').json()[0]['action'] == 'Settings updated'

def test_provider_status_never_returns_credentials(client, monkeypatch):
    secret = 'sk-local-test-secret-do-not-expose'
    monkeypatch.setenv('OPENAI_API_KEY', secret)
    result = client.get('/api/settings/provider-status')
    assert result.status_code == 200
    assert secret not in result.text
    assert result.json()['openai_key_configured']
    assert result.json()['network_tested'] is False

def test_brand_direction_is_used_by_new_story_generation(client):
    brand = client.get('/api/settings/brand').json()['data']
    brand['prompt_style'] = 'Watercolor paper textures with warm sunset lighting'
    assert client.put('/api/settings/brand',json=brand).status_code == 200
    ep = schedule(client, make_series(client))
    generated = client.post(f"/api/episodes/{ep['id']}/generate").json()
    assert brand['prompt_style'] in generated['story']['scenes'][0]['visual_prompt']
    brand['primary'] = 'javascript:invalid'
    assert client.put('/api/settings/brand',json=brand).status_code == 422
    brand['primary'] = '#7B3FF2'
    brand['logo'] = 'data:image/svg+xml;base64,PHN2Zz4='
    assert client.put('/api/settings/brand',json=brand).status_code == 422

def test_team_drafts_and_permission_plans_do_not_enforce_access(client):
    member = {'name':'Editor draft','data':{'name':'Editor','email':'editor@example.com','role':'Editor','status':'Draft'}}
    assert client.post('/api/studio/records/team_member',json=member).status_code == 201
    assert client.get('/api/settings/provider-status').json()['auth_enforced'] is False
    roles = client.get('/api/settings/roles').json()['data']
    roles['matrix']['Owner'] = []
    assert client.put('/api/settings/roles',json=roles).status_code == 422
    member['data']['email'] = 'invalid-email'
    assert client.post('/api/studio/records/team_member',json=member).status_code == 422

def test_budget_and_manual_cost_estimates(client):
    budget = {'monthly_inr':'2500.50','warning_percent':80,'show_estimate_alerts':True}
    assert client.put('/api/settings/budget',json=budget).status_code == 200
    assert client.get('/api/settings/budget').json()['data']['monthly_inr'] == '2500.50'
    entry = {'name':'Script estimate','data':{'provider':'OpenAI','category':'Script','amount_inr':'12.50','quantity':1,'recorded_on':'2026-11-16','note':'Manual estimate, not a provider invoice'}}
    saved = client.post('/api/studio/records/cost_entry',json=entry)
    assert saved.status_code == 201
    assert saved.json()['data']['amount_inr'] == '12.50'
    entry['data']['amount_inr'] = '-1.00'
    assert client.post('/api/studio/records/cost_entry',json=entry).status_code == 422
    budget['warning_percent'] = 120
    assert client.put('/api/settings/budget',json=budget).status_code == 422
