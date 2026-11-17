from datetime import date, datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from sqlmodel import select
from test_workflow import client
from app.main import app
from app.db import get_session
from app.channels import configure_from_file
from app.models import Series, StudioRecord, WorkspaceSetting
from app.scheduler import occurrences
from app.operations import RecurringData
from app.generator import generate_story

def test_two_channels_keep_unique_series_schedules_and_prompts(client, monkeypatch):
    dependency = app.dependency_overrides[get_session]()
    db = next(dependency)
    config_path = Path(__file__).resolve().parents[2] / 'config/channels.json'
    first = configure_from_file(config_path, db, date(2026,11,17))
    second = configure_from_file(config_path, db, date(2026,11,17))
    assert [(p['series_id'],p['schedule_id']) for p in first] == [(p['series_id'],p['schedule_id']) for p in second]
    assert len(db.exec(select(Series)).all()) == 2
    assert len(db.exec(select(StudioRecord).where(StudioRecord.kind == 'recurring_schedule')).all()) == 2
    assert first[0]['series_id'] != first[1]['series_id']
    assert client.get('/api/channels').json()['calendar_connected'] is False
    now = datetime(2026,11,17,0,tzinfo=timezone.utc)
    for p, hour in zip(first,[10,13]):
        plan = db.get(StudioRecord,p['schedule_id'])
        next_slot = occurrences(RecurringData.model_validate(plan.data),now)[0]
        assert next_slot.hour == hour and next_slot.minute == 30
        assert p['language'] == 'Tamil' and p['review_required'] and p['reminder_minutes'] == 15
    captured=[]
    monkeypatch.setenv('GENERATION_MODE','openai')
    monkeypatch.setenv('OPENAI_API_KEY','fixture')
    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.responses=self
        def parse(self, **kwargs):
            captured.append(kwargs)
            # Obtain a valid sample using the no-cost template generator.
            monkeypatch.setenv('GENERATION_MODE','demo')
            sample,_ = generate_story(db.get(Series,first[0]['series_id']),SimpleNamespace(topic='Technical example'),[])
            monkeypatch.setenv('GENERATION_MODE','openai')
            return SimpleNamespace(output_parsed=sample)
    monkeypatch.setattr('app.generator.OpenAI',FakeOpenAI)
    for p in first:
        generate_story(db.get(Series,p['series_id']),SimpleNamespace(topic='New topic'),[],brand={'name':'Other brand'},channel=p)
    assert 'technical educational' in captured[0]['input'][0]['content']
    assert 'cartoon episode' in captured[1]['input'][0]['content']
    assert all('Tamil script' in call['input'][0]['content'] for call in captured)
    assert all('"brand_direction": null' in call['input'][1]['content'] for call in captured)
    dependency.close()
