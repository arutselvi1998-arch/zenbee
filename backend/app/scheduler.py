"""Materialize a bounded future window of a saved recurring schedule."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
from .db import get_session
from .models import Episode, ScheduleOccurrence, Series, StudioRecord, StudioEvent, WorkspaceSetting, utcnow
from .operations import RecurringData

router = APIRouter(prefix='/api/production')
IST = timezone(timedelta(hours=5, minutes=30))

def occurrences(plan, now):
    hour, minute = map(int, plan.time.split(':'))
    start = datetime.combine(plan.start_date, datetime.min.time(), IST).replace(hour=hour, minute=minute)
    step = timedelta(hours=plan.interval_hours) if plan.frequency == 'Custom' else timedelta(days=1)
    skip = max(0, int((now - start).total_seconds() // step.total_seconds()))
    result = []
    for i in range(skip, skip + 3700):
        candidate = start + step * i
        if candidate <= now:
            continue
        if plan.frequency == 'Weekly' and (candidate.weekday() + 1) % 7 not in plan.weekdays:
            continue
        if plan.frequency == 'Monthly' and candidate.day != plan.month_day:
            continue
        result.append(candidate.astimezone(timezone.utc))
        if len(result) == plan.count:
            break
    return result

def materialize(record, db, now=None):
    if not record.enabled:
        raise HTTPException(409, 'Enable this recurring schedule first')
    plan = RecurringData.model_validate(record.data)
    series = db.get(Series, plan.series_id)
    if not series:
        raise HTTPException(404, 'Series no longer exists')
    now = now or utcnow()
    settings = db.get(WorkspaceSetting, 'system')
    lead = (settings.data if settings else {}).get('generation_lead_hours', 24)
    created = 0
    for publish_at in occurrences(plan, now):
        existing = db.exec(select(ScheduleOccurrence).where(ScheduleOccurrence.schedule_id == record.id,
            ScheduleOccurrence.publish_at == publish_at)).first()
        if existing:
            continue
        try:
            episode = Episode(series_id=series.id, topic=f'{series.name}: {record.name} — {publish_at.astimezone(IST):%d %b %Y %H:%M}',
                publish_at=publish_at, generate_at=max(now, publish_at - timedelta(hours=lead)))
            db.add(episode)
            db.flush()
            db.add(ScheduleOccurrence(schedule_id=record.id, episode_id=episode.id, publish_at=publish_at))
            db.add(StudioEvent(episode_id=episode.id, action='Recurring episode scheduled', detail=record.name))
            db.commit()
            created += 1
        except IntegrityError:
            # Unique occurrence protects against two scheduler callers racing.
            db.rollback()
    return created

@router.post('/schedules/{record_id}/materialize')
def create_scheduled_episodes(record_id: int, db: Session = Depends(get_session)):
    record = db.get(StudioRecord, record_id)
    if not record or record.kind != 'recurring_schedule':
        raise HTTPException(404, 'Recurring schedule not found')
    return {'created': materialize(record, db)}
