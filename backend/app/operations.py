from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from sqlmodel import Session, select
from .db import get_session
from .models import Episode, Series, StudioRecord, StudioEvent, utcnow
from .settings import TeamMemberData, CostEntryData

router = APIRouter(prefix='/api')
Kind = Literal['recurring_schedule', 'automation_rule', 'quality_review', 'seo', 'team_member', 'cost_entry']
Platform = Literal['YouTube', 'Instagram']

class StrictData(BaseModel):
    model_config = ConfigDict(extra='forbid')

class RecurringData(StrictData):
    series_id: int
    frequency: Literal['Daily', 'Weekly', 'Monthly', 'Custom']
    time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    start_date: date
    weekdays: list[int] = Field(default_factory=list, max_length=7)
    month_day: int = Field(default=1, ge=1, le=31)
    interval_hours: int = Field(default=24, ge=1, le=168)
    count: int = Field(default=7, ge=1, le=30)
    platforms: list[Platform] = Field(min_length=1, max_length=2)

    @model_validator(mode='after')
    def valid_days(self):
        if any(day < 0 or day > 6 for day in self.weekdays):
            raise ValueError('Weekdays must be between 0 and 6')
        if self.frequency == 'Weekly' and not self.weekdays:
            raise ValueError('Select at least one weekday')
        return self

class RuleData(StrictData):
    trigger: Literal['Episode scheduled', 'Script ready', 'Time based', 'New idea added']
    actions: list[Literal['Generate story', 'Generate video', 'Add voice & music', 'Prepare SEO', 'Request review', 'Publish content', 'Send notification']] = Field(min_length=1, max_length=10)
    require_approval: bool = True

class ReviewData(StrictData):
    episode_id: int
    decision: Literal['Pending', 'Approved', 'Changes requested', 'Rejected'] = 'Pending'
    checklist: dict[str, bool] = Field(default_factory=dict)
    comment: str = Field(default='', max_length=3000)

class SeoData(StrictData):
    episode_id: int
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(default='', max_length=5000)
    caption: str = Field(default='', max_length=2200)
    tags: list[str] = Field(default_factory=list, max_length=30)
    platform: Platform = 'YouTube'

class RecordWrite(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    enabled: bool = True
    data: dict

    @field_validator('name')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('A name is required')
        return value.strip()

class ScheduleEdit(BaseModel):
    publish_at: Optional[datetime] = None
    lead_hours: int = Field(default=24, ge=1, le=168)
    cancel: bool = False

    @field_validator('publish_at')
    @classmethod
    def future_time(cls, value):
        if value is not None and (value.tzinfo is None or value.utcoffset() is None or value <= utcnow()):
            raise ValueError('Choose a future publishing time with a timezone')
        return value.astimezone(timezone.utc) if value is not None else None

def validate_data(kind: str, data: dict, db: Session):
    schema = {'recurring_schedule': RecurringData, 'automation_rule': RuleData,
              'quality_review': ReviewData, 'seo': SeoData, 'team_member':TeamMemberData, 'cost_entry':CostEntryData}[kind]
    try:
        value = schema.model_validate(data)
    except ValidationError as error:
        raise HTTPException(422, '; '.join(e['msg'] for e in error.errors()))
    if kind == 'recurring_schedule' and not db.get(Series, value.series_id):
        raise HTTPException(404, 'Create a workspace series before saving a recurring schedule')
    if kind in {'quality_review', 'seo'}:
        episode = db.get(Episode, value.episode_id)
        if episode is None:
            raise HTTPException(404, 'Choose a saved workspace episode')
        if kind == 'quality_review' and value.decision == 'Approved':
            if not episode.story:
                raise HTTPException(409, 'Generate a script before approving its review')
            if not all(value.checklist.get(key) for key in ['script', 'characters', 'continuity']):
                raise HTTPException(422, 'Review the script, characters and continuity before approval')
    return value.model_dump(mode='json')

@router.get('/studio/records/{kind}', response_model=list[StudioRecord])
def list_records(kind: Kind, db: Session = Depends(get_session)):
    return db.exec(select(StudioRecord).where(StudioRecord.kind == kind).order_by(StudioRecord.updated_at.desc())).all()

@router.post('/studio/records/{kind}', response_model=StudioRecord, status_code=201)
def create_record(kind: Kind, data: RecordWrite, db: Session = Depends(get_session)):
    content = validate_data(kind, data.data, db)
    item = StudioRecord(kind=kind, name=data.name, enabled=data.enabled, data=content)
    db.add(item)
    db.add(StudioEvent(action='Plan saved', detail=f'{kind.replace("_", " ")}: {data.name}'))
    db.commit()
    db.refresh(item)
    return item

@router.put('/studio/records/{kind}/{record_id}', response_model=StudioRecord)
def update_record(kind: Kind, record_id: int, data: RecordWrite, db: Session = Depends(get_session)):
    item = db.get(StudioRecord, record_id)
    if not item or item.kind != kind:
        raise HTTPException(404, 'Studio record not found')
    item.data = validate_data(kind, data.data, db)
    item.name, item.enabled, item.updated_at = data.name, data.enabled, utcnow()
    db.add(item)
    db.add(StudioEvent(action='Plan updated', detail=f'{kind.replace("_", " ")}: {data.name}'))
    db.commit()
    db.refresh(item)
    return item

@router.get('/studio/events', response_model=list[StudioEvent])
def list_events(db: Session = Depends(get_session)):
    return db.exec(select(StudioEvent).order_by(StudioEvent.id.desc()).limit(100)).all()

@router.put('/episodes/{episode_id}/schedule', response_model=Episode)
def edit_schedule(episode_id: int, data: ScheduleEdit, db: Session = Depends(get_session)):
    item = db.get(Episode, episode_id)
    if not item:
        raise HTTPException(404, 'Episode not found')
    if item.status == 'generating':
        raise HTTPException(409, 'Wait for story generation to finish before changing the schedule')
    if data.cancel:
        item.status = 'cancelled'
        action = 'Schedule cancelled'
    else:
        if data.publish_at is None:
            raise HTTPException(422, 'A future publishing time is required')
        item.publish_at = data.publish_at
        item.generate_at = max(utcnow(), data.publish_at - timedelta(hours=data.lead_hours))
        item.status = 'script_ready' if item.story else 'scheduled'
        action = 'Episode rescheduled'
    db.add(item)
    db.add(StudioEvent(episode_id=episode_id, action=action, detail=item.topic))
    db.commit()
    db.refresh(item)
    return item
