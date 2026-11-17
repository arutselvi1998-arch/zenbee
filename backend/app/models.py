from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, JSON, DateTime, UniqueConstraint
from sqlmodel import SQLModel, Field

def utcnow():
    return datetime.now(timezone.utc)

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
    id: Optional[int] = Field(default=None, primary_key=True)
    episode_id: int = Field(foreign_key='episode.id', index=True)
    status: str = Field(default='queued', index=True)
    attempts: int = 0
    error: Optional[str] = None
    story_snapshot: dict = Field(sa_column=Column(JSON, nullable=False))
    voice: bool = False
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True)))

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
