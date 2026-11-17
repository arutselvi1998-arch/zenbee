import os
from datetime import date
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlmodel import Session
from .db import get_session
from .models import WorkspaceSetting, StudioEvent, utcnow

router = APIRouter(prefix='/api/settings')
Section = Literal['system', 'brand', 'notifications', 'budget', 'providers', 'roles', 'social']
Role = Literal['Owner', 'Admin', 'Content Manager', 'Editor', 'Designer', 'Publisher', 'Analyst']
Permission = Literal['Dashboard', 'Content Studio', 'Automation', 'Publishing', 'Analytics', 'Settings']

class StrictSetting(BaseModel):
    model_config = ConfigDict(extra='forbid')

class SystemSettings(StrictSetting):
    workspace_name: str = Field(default='ZENBEE Studio', min_length=1, max_length=80)
    language: Literal['English', 'Tamil', 'Hindi'] = 'English'
    timezone: Literal['Asia/Kolkata'] = 'Asia/Kolkata'
    date_format: Literal['DD-MM-YYYY', 'YYYY-MM-DD'] = 'DD-MM-YYYY'
    resolution: Literal['1080p', '720p'] = '1080p'
    aspect_ratio: Literal['9:16', '16:9', '1:1'] = '9:16'
    image_format: Literal['PNG', 'JPEG', 'WebP'] = 'PNG'
    generation_lead_hours: int = Field(default=24, ge=1, le=168)
    retry_attempts: int = Field(default=3, ge=0, le=5)
    concurrency: int = Field(default=1, ge=1, le=4)
    caption_template: str = Field(default='A little spark. A new ZENBEE story. #ZENBEE', max_length=1000)
    autosave_drafts: bool = True

class BrandSettings(StrictSetting):
    name: str = Field(default='ZENBEE Studio', min_length=1, max_length=80)
    tagline: str = Field(default='A little spark. Endless stories.', max_length=150)
    description: str = Field(default='Create imaginative, family-friendly cartoon stories.', max_length=2000)
    primary: str = Field(default='#7B3FF2', pattern=r'^#[0-9A-Fa-f]{6}$')
    secondary: str = Field(default='#FF3F8E', pattern=r'^#[0-9A-Fa-f]{6}$')
    accent: str = Field(default='#FFB26B', pattern=r'^#[0-9A-Fa-f]{6}$')
    background: str = Field(default='#F9F7FF', pattern=r'^#[0-9A-Fa-f]{6}$')
    surface: str = Field(default='#FFFFFF', pattern=r'^#[0-9A-Fa-f]{6}$')
    text: str = Field(default='#241337', pattern=r'^#[0-9A-Fa-f]{6}$')
    heading_font: Literal['Arial', 'Georgia', 'Verdana', 'Trebuchet MS'] = 'Arial'
    body_font: Literal['Arial', 'Georgia', 'Verdana', 'Trebuchet MS'] = 'Arial'
    visual_style: Literal['Modern', 'Playful', 'Minimal', 'Creative'] = 'Playful'
    prompt_style: str = Field(default='Vibrant 3D cartoon, warm magical light, expressive family-friendly characters.', max_length=2000)
    logo: str = Field(default='', max_length=400000)

    @model_validator(mode='after')
    def image_only(self):
        import base64
        if self.logo:
            import re
            if not re.fullmatch(r'data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+', self.logo):
                raise ValueError('Use a PNG, JPEG or WebP logo under 250 KB')
            try:
                raw = base64.b64decode(self.logo.split(',', 1)[1], validate=True)
            except ValueError:
                raise ValueError('Logo encoding is invalid')
            if len(raw) > 250000:
                raise ValueError('Logo must be under 250 KB')
            if not (raw.startswith(b'\x89PNG\r\n\x1a\n') or raw.startswith(b'\xff\xd8\xff') or (raw.startswith(b'RIFF') and raw[8:12] == b'WEBP')):
                raise ValueError('Logo contents must be a supported image')
        return self

class NotificationSettings(StrictSetting):
    generation: bool = True
    publishing: bool = True
    automation: bool = True
    costs: bool = True
    team: bool = True
    system: bool = True
    in_app: bool = True
    email_requested: bool = False
    frequency: Literal['Instant', 'Daily summary', 'Weekly summary'] = 'Instant'

class BudgetSettings(StrictSetting):
    monthly_inr: Decimal = Field(default=Decimal('3000.00'), ge=0, le=10000000, max_digits=10, decimal_places=2)
    warning_percent: int = Field(default=80, ge=1, le=100)
    show_estimate_alerts: bool = True

class ProviderSettings(StrictSetting):
    preferred_story_provider: Literal['OpenAI', 'Demo'] = 'Demo'
    preferred_video_provider: Literal['Not configured', 'Google video API', 'Other API'] = 'Not configured'
    preferred_voice_provider: Literal['Not configured', 'TTS API'] = 'Not configured'
    monthly_request_target: int = Field(default=100, ge=1, le=100000)

class RoleSettings(StrictSetting):
    matrix: dict[Role, list[Permission]] = Field(default_factory=lambda: {
        'Owner':['Dashboard','Content Studio','Automation','Publishing','Analytics','Settings'],
        'Admin':['Dashboard','Content Studio','Automation','Publishing','Analytics','Settings'],
        'Content Manager':['Dashboard','Content Studio','Analytics'],
        'Editor':['Dashboard','Content Studio'], 'Designer':['Dashboard','Content Studio'],
        'Publisher':['Dashboard','Publishing'], 'Analyst':['Dashboard','Analytics']})

    @model_validator(mode='after')
    def preserve_owner(self):
        if set(self.matrix.get('Owner', [])) != {'Dashboard','Content Studio','Automation','Publishing','Analytics','Settings'}:
            raise ValueError('The owner role must retain all planned permissions')
        return self

class SocialSettings(StrictSetting):
    preferred_platforms: list[Literal['YouTube', 'Instagram', 'Facebook', 'TikTok', 'Pinterest', 'X']] = Field(default_factory=lambda:['YouTube','Instagram'], max_length=6)
    default_platform: Literal['YouTube', 'Instagram', 'Facebook', 'TikTok', 'Pinterest', 'X'] = 'YouTube'
    require_review: bool = True
    cross_post_requested: bool = False

class TeamMemberData(StrictSetting):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(max_length=254, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    role: Role = 'Editor'
    status: Literal['Draft', 'Planned', 'Archived'] = 'Draft'

class CostEntryData(StrictSetting):
    provider: str = Field(min_length=1, max_length=80)
    category: Literal['Script', 'Video', 'Image', 'Voice', 'Other']
    amount_inr: Decimal = Field(ge=0, le=1000000, max_digits=9, decimal_places=2)
    quantity: int = Field(default=1, ge=1, le=100000)
    recorded_on: date
    note: str = Field(default='', max_length=1000)

SCHEMAS = {'system': SystemSettings, 'brand': BrandSettings, 'notifications': NotificationSettings,
           'budget': BudgetSettings, 'providers': ProviderSettings, 'roles': RoleSettings, 'social': SocialSettings}

@router.get('/provider-status')
def provider_status():
    mode = os.getenv('GENERATION_MODE', 'demo')
    return {'generation_mode':mode, 'openai_key_configured':bool(os.getenv('OPENAI_API_KEY')),
            'story_model':os.getenv('OPENAI_MODEL', 'gpt-4.1-mini'),
            'credential_source':'server environment', 'network_tested':False,
            'video_connected':False, 'voice_connected':False, 'publishing_connected':False,
            'auth_enforced':os.getenv('AUTH_REQUIRED', '0') == '1', 'cost_metering_connected':False}

@router.get('/{section}')
def read_settings(section: Section, db: Session = Depends(get_session)):
    saved = db.get(WorkspaceSetting, section)
    return {'key':section, 'data':saved.data if saved else SCHEMAS[section]().model_dump(mode='json'),
            'updated_at':saved.updated_at if saved else None}

@router.put('/{section}')
def save_settings(section: Section, data: dict, db: Session = Depends(get_session)):
    try:
        value = SCHEMAS[section].model_validate(data)
    except ValidationError as error:
        raise HTTPException(422, '; '.join(e['msg'] for e in error.errors()))
    if section == 'system' and not value.workspace_name.strip():
        raise HTTPException(422, 'Workspace name cannot be blank')
    if section == 'brand' and not value.name.strip():
        raise HTTPException(422, 'Brand name cannot be blank')
    saved = db.get(WorkspaceSetting, section) or WorkspaceSetting(key=section, data={})
    saved.data = value.model_dump(mode='json')
    saved.updated_at = utcnow()
    db.add(saved)
    db.add(StudioEvent(action='Settings updated', detail=f'{section.title()} preferences saved.'))
    db.commit()
    return {'key':section, 'data':saved.data, 'updated_at':saved.updated_at}
