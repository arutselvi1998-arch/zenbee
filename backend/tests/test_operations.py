from datetime import datetime, timedelta, timezone
from test_workflow import client, make_series, schedule

def test_rules_and_recurring_schedules_persist_without_running(client):
    sid = make_series(client)
    recurring = {'name':'Daily ZENBEE','enabled':True,'data':{
        'series_id':sid,'frequency':'Weekly','time':'18:00','start_date':'2026-11-17',
        'weekdays':[2,4],'platforms':['YouTube']}}
    r = client.post('/api/studio/records/recurring_schedule', json=recurring)
    assert r.status_code == 201
    assert client.get('/api/episodes').json() == []
    assert client.get('/api/studio/records/recurring_schedule').json()[0]['data']['weekdays'] == [2,4]
    recurring['enabled'] = False
    assert not client.put(f"/api/studio/records/recurring_schedule/{r.json()['id']}",json=recurring).json()['enabled']
    recurring['data']['weekdays'] = []
    assert client.post('/api/studio/records/recurring_schedule',json=recurring).status_code == 422
    rule = {'name':'Review before publishing','data':{'trigger':'Script ready','actions':['Prepare SEO','Request review'],'require_approval':True}}
    assert client.post('/api/studio/records/automation_rule',json=rule).status_code == 201
    rule['data']['actions'] = ['Unsupported secret action']
    assert client.post('/api/studio/records/automation_rule',json=rule).status_code == 422

def test_review_requires_a_script_and_checked_core_criteria(client):
    ep = schedule(client, make_series(client))
    review = {'name':'Script review','data':{'episode_id':ep['id'],'decision':'Approved','checklist':{}}}
    assert client.post('/api/studio/records/quality_review',json=review).status_code == 409
    client.post(f"/api/episodes/{ep['id']}/generate")
    assert client.post('/api/studio/records/quality_review',json=review).status_code == 422
    review['data']['checklist'] = {'script':True,'characters':True,'continuity':True}
    assert client.post('/api/studio/records/quality_review',json=review).status_code == 201
    # Script approval never publishes an episode or marks a video as generated.
    assert client.get('/api/episodes').json()[0]['status'] == 'script_ready'
    story = client.get('/api/episodes').json()[0]['story']
    story['scenes'][0]['dialogue'] = 'A revised line needs a fresh review.'
    assert client.put(f"/api/episodes/{ep['id']}/story",json=story).status_code == 200
    saved_review = client.get('/api/studio/records/quality_review').json()[0]
    assert saved_review['data']['decision'] == 'Pending'
    assert saved_review['data']['checklist'] == {}

def test_reschedule_cancel_restore_and_audit_log(client):
    ep = schedule(client, make_series(client))
    url = f"/api/episodes/{ep['id']}/schedule"
    assert client.put(url,json={'cancel':True}).json()['status'] == 'cancelled'
    assert client.post(f"/api/episodes/{ep['id']}/generate").status_code == 409
    future = (datetime.now(timezone.utc)+timedelta(days=5)).isoformat()
    restored = client.put(url,json={'publish_at':future,'lead_hours':48}).json()
    assert restored['status'] == 'scheduled'
    assert datetime.fromisoformat(restored['publish_at'].replace('Z','+00:00'))-datetime.fromisoformat(restored['generate_at'].replace('Z','+00:00')) == timedelta(hours=48)
    assert client.put(url,json={'publish_at':'2020-01-01T18:00:00Z'}).status_code == 422
    actions = [e['action'] for e in client.get('/api/studio/events').json()]
    assert 'Schedule cancelled' in actions and 'Episode rescheduled' in actions

def test_seo_metadata_is_scoped_and_validated(client):
    ep = schedule(client, make_series(client))
    data = {'name':'SEO draft','data':{'episode_id':ep['id'],'title':'The Rainbow Flower','tags':['ZENBEE','cartoon'],'platform':'YouTube'}}
    saved = client.post('/api/studio/records/seo',json=data)
    assert saved.status_code == 201
    data['data']['caption'] = 'A little spark of magic!'
    assert client.put(f"/api/studio/records/seo/{saved.json()['id']}",json=data).json()['data']['caption'] == data['data']['caption']
    assert client.put(f"/api/studio/records/quality_review/{saved.json()['id']}",json={'name':'Wrong type','data':{'episode_id':ep['id']}}).status_code == 404
    data['data']['episode_id'] = 999
    assert client.post('/api/studio/records/seo',json=data).status_code == 404
