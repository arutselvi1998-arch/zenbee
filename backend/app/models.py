from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, JSON, DateTime, UniqueConstraint, Index, text
from sqlmodel import SQLModel, Field

def utcnow():
    return datetime.now(timezone.utc)

def as_utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

class Series(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: str = ''
    visual_style: str
    characters: str
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))

class Episode(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    series_id: int = Field(foreign_key='series.id', index=True)
    topic: str
    publish_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    generate_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    status: str = 'scheduled'
    attempts: int = 0
    error: Optional[str] = None
    story: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    generation_mode: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))

class StudioRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    kind: str = Field(index=True)
    name: str
    enabled: bool = True
    data: dict = Field(sa_column=Column(JSON, nullable=False))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))

class StudioEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    episode_id: Optional[int] = Field(default=None, foreign_key='episode.id')
    action: str
    detail: str
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))

class WorkspaceSetting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    data: dict = Field(sa_column=Column(JSON, nullable=False))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))

class ProductionJob(SQLModel, table=True):
    __table_args__ = (Index('uq_production_active_episode', 'episode_id', unique=True,
        sqlite_where=text("status IN ('queued','rendering')"), postgresql_where=text("status IN ('queued','rendering')")),)
    id: Optional[int] = Field(default=None, primary_key=True)
    episode_id: int = Field(foreign_key='episode.id', index=True)
    status: str = Field(default='queued', index=True)
    attempts: int = 0
    error: Optional[str] = None
    story_snapshot: dict = Field(sa_column=Column(JSON, nullable=False))
    voice: bool = False
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))

class AnimationPlan(SQLModel, table=True):
    job_id: int = Field(primary_key=True, foreign_key='productionjob.id')
    model: str = 'gen4.5'
    context: dict = Field(sa_column=Column(JSON, nullable=False))

class ThumbnailAsset(SQLModel, table=True):
    job_id: int = Field(primary_key=True, foreign_key='productionjob.id')
    digest: str
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))

class ReleaseThumbnail(SQLModel, table=True):
    release_id: int = Field(primary_key=True, foreign_key='scheduledrelease.id')
    digest: str

class AnimationClip(SQLModel, table=True):
    __table_args__ = (UniqueConstraint('job_id', 'part'),)
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key='productionjob.id', index=True)
    part: int
    scene_index: int
    duration: int
    state: str = 'pending'
    task_id: Optional[str] = None

class ScheduleOccurrence(SQLModel, table=True):
    __table_args__ = (UniqueConstraint('schedule_id', 'publish_at'),)
    id: Optional[int] = Field(default=None, primary_key=True)
    schedule_id: int = Field(foreign_key='studiorecord.id', index=True)
    episode_id: int = Field(foreign_key='episode.id')
    publish_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))

class OwnerAccount(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True)
    password_hash: str
    failed_attempts: int = 0
    locked_until: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))

class LoginSession(SQLModel, table=True):
    token_hash: str = Field(primary_key=True)
    account_id: int = Field(foreign_key='owneraccount.id')
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))

class ProviderConnection(SQLModel, table=True):
    __table_args__ = (UniqueConstraint('channel_key', 'provider'),)
    id: Optional[int] = Field(default=None, primary_key=True)
    channel_key: str = Field(index=True)
    provider: str
    account_id: str
    account_label: str
    encrypted_tokens: str
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))

class OAuthAttempt(SQLModel, table=True):
    state_hash: str = Field(primary_key=True)
    channel_key: str
    provider: str
    verifier: str
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))

class ScheduledRelease(SQLModel, table=True):
    __table_args__ = (Index('uq_release_active_job', 'job_id', unique=True,
        sqlite_where=text("status <> 'cancelled'"), postgresql_where=text("status <> 'cancelled'")),)
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key='productionjob.id', index=True)
    channel_key: str = Field(index=True)
    title: str
    caption: str
    made_for_kids: bool
    publish_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    media_hash: str
    status: str = Field(default='pending_review', index=True)
    platform_results: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    calendar_status: str = 'pending'
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))
