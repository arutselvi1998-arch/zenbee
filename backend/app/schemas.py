from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator

class SeriesCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=2000)
    visual_style: str = Field(min_length=1, max_length=2000)
    characters: str = Field(min_length=1, max_length=5000)

    @field_validator('name', 'visual_style', 'characters')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('This field cannot be blank')
        return value.strip()

class EpisodeCreate(BaseModel):
    series_id: int
    topic: str = Field(min_length=1, max_length=1000)
    publish_at: datetime
    lead_hours: int = Field(default=24, ge=1, le=168)

    @field_validator('topic')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('Topic cannot be blank')
        return value.strip()

    @field_validator('publish_at')
    @classmethod
    def future_with_timezone(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError('Publishing time must include a timezone')
        if value <= datetime.now(timezone.utc):
            raise ValueError('Publishing time must be in the future')
        return value.astimezone(timezone.utc)

class Scene(BaseModel):
    number: int
    duration_seconds: int = Field(ge=1, le=15)
    visual_prompt: str
    dialogue: str
    narration: str
    caption: str

class Story(BaseModel):
    title: str
    synopsis: str
    continuity_notes: str
    scenes: list[Scene] = Field(min_length=3, max_length=8)
    description: str
    hashtags: list[str]
