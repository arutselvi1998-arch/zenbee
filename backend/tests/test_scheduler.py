from datetime import datetime, timezone
from test_workflow import client, make_series
from app.operations import RecurringData
from app.scheduler import occurrences

def test_recurring_materialization_is_idempotent_and_disabled_plans_refuse(client):
    sid = make_series(client)
    body = {'name':'New episode', 'enabled':True, 'data':{'series_id':sid,
        'frequency':'Daily', 'time':'18:00', 'start_date':'2090-01-01', 'count':3, 'platforms':['YouTube']}}
    saved = client.post('/api/studio/records/recurring_schedule', json=body).json()
    url = f"/api/production/schedules/{saved['id']}/materialize"
    assert client.post(url).json() == {'created':3}
    assert client.post(url).json() == {'created':0}
    episodes = client.get('/api/episodes').json()
    assert len(episodes) == 3
    assert '12:30:00' in episodes[0]['publish_at']
    assert all(e['status'] == 'scheduled' and not e['story'] for e in episodes)
    body['enabled'] = False
    client.put(f"/api/studio/records/recurring_schedule/{saved['id']}", json=body)
    assert client.post(url).status_code == 409

def test_monthly_skips_nonexistent_days_and_weekdays_use_sunday_zero():
    base = dict(series_id=1,time='18:00',start_date='2027-02-01',count=3,platforms=['YouTube'])
    now = datetime(2027,2,1,tzinfo=timezone.utc)
    monthly = occurrences(RecurringData(**base, frequency='Monthly',month_day=31),now)
    assert [d.month for d in monthly] == [3,5,7]
    weekly = occurrences(RecurringData(**base, frequency='Weekly',weekdays=[0]),now)
    assert all(d.weekday() == 6 for d in weekly)
