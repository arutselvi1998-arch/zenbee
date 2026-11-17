"""Channel-specific content plans. Account URLs are references, not OAuth tokens."""
import json
from datetime import date
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator
from sqlmodel import Session, select
from .db import get_session
from .models import Series, StudioRecord, WorkspaceSetting, StudioEvent, ProviderConnection, utcnow
from .operations import RecurringData

router = APIRouter(prefix='/api/channels')

class ChannelProfile(BaseModel):
    model_config = ConfigDict(extra='forbid')
    key: str = Field(pattern=r'^[a-z0-9-]{1,60}$')
    name: str = Field(min_length=1, max_length=120)
    youtube_url: HttpUrl
    instagram_url: HttpUrl
    content_type: Literal['technical', 'cartoon stories']
    language: Literal['Tamil'] = 'Tamil'
    publish_time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    timezone: Literal['Asia/Kolkata'] = 'Asia/Kolkata'
    review_required: Literal[True] = True
    reminder_service: Literal['Google Calendar'] = 'Google Calendar'
    reminder_minutes: Literal[15] = 15

    @field_validator('youtube_url', 'instagram_url')
    @classmethod
    def official_account_url(cls, value, info):
        domain = 'youtube.com' if info.field_name == 'youtube_url' else 'instagram.com'
        if value.scheme != 'https' or value.host not in {domain, 'www.' + domain}:
            raise ValueError('Use the HTTPS account link on the selected platform')
        return value

class ChannelConfiguration(BaseModel):
    model_config = ConfigDict(extra='forbid')
    channels: list[ChannelProfile] = Field(min_length=2, max_length=2)

def configure_channels(config: ChannelConfiguration, db: Session, start_date: date):
    if len({p.key for p in config.channels}) != len(config.channels):
        raise ValueError('Channel keys must be unique')
    setting = db.get(WorkspaceSetting, 'channel_profiles')
    previous = {p['key']:p for p in setting.data['channels']} if setting else {}
    profiles = []
    for profile in config.channels:
        old = previous.get(profile.key, {})
        series = db.get(Series, old.get('series_id')) if old.get('series_id') else None
        if not series:
            technical = profile.content_type == 'technical'
            series = Series(name=profile.name,
                description=f'{profile.language} {profile.content_type} for {profile.name}. Separate content and memory from other channels.',
                visual_style='Clear technical education visuals' if technical else 'Family-friendly cartoon storytelling',
                characters='No fixed presenter specified' if technical else 'No fixed recurring cast specified')
            db.add(series)
            db.flush()
        plan = db.get(StudioRecord, old.get('schedule_id')) if old.get('schedule_id') else None
        plan_data = RecurringData(series_id=series.id, frequency='Daily', time=profile.publish_time,
            start_date=start_date, count=7, platforms=['YouTube','Instagram']).model_dump(mode='json')
        if not plan:
            plan = StudioRecord(kind='recurring_schedule', name=f'{profile.name} — Daily {profile.language}', enabled=True, data=plan_data)
        else:
            plan.data, plan.enabled, plan.updated_at = plan_data, True, utcnow()
        db.add(plan)
        db.flush()
        profiles.append({**profile.model_dump(mode='json'), 'series_id':series.id, 'schedule_id':plan.id})
    if not setting:
        setting = WorkspaceSetting(key='channel_profiles', data={'channels':profiles})
    else:
        setting.data, setting.updated_at = {'channels':profiles}, utcnow()
    db.add(setting)
    db.add(StudioEvent(action='Channel plans configured', detail='Two separate Tamil content streams, daily at 16:00 and 19:00 India time. Publishing and Calendar connections still required.'))
    db.commit()
    return profiles

@router.get('')
def list_channels(db: Session = Depends(get_session)):
    setting = db.get(WorkspaceSetting, 'channel_profiles')
    profiles=setting.data['channels'] if setting else []
    authorized={(r.channel_key,r.provider) for r in db.exec(select(ProviderConnection)).all()}
    return {'channels':profiles,
        'publishing_connected':bool(profiles) and all((p['key'],provider) in authorized for p in profiles for provider in ['google','instagram']),
        'calendar_connected':bool(profiles) and all((p['key'],'google') in authorized for p in profiles)}

def configure_from_file(path: Path, db: Session, start_date: date):
    return configure_channels(ChannelConfiguration.model_validate(json.loads(path.read_text(encoding='utf-8'))), db, start_date)
