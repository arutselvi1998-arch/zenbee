import logging
import os
from contextlib import asynccontextmanager
from datetime import timedelta
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update
from sqlmodel import Session, select
from .db import init_db, get_session
from .models import Series, Episode, StudioRecord, StudioEvent, WorkspaceSetting, utcnow
from .operations import router as operations_router
from .settings import router as settings_router
from .schemas import SeriesCreate, EpisodeCreate
from .generator import generate_story
from .production import router as production_router, start_worker
from .scheduler import router as scheduler_router
from .security import router as security_router, enabled as auth_enabled, account_for, check_origin

@asynccontextmanager
async def lifespan(app):
    init_db()
    stop = start_worker() if os.getenv('PRODUCTION_WORKER', '0') == '1' else None
    yield
    if stop:
        stop.set()

app = FastAPI(title='ZENBEE Studio API', lifespan=lifespan)
app.include_router(operations_router)
app.include_router(settings_router)
app.include_router(production_router)
app.include_router(scheduler_router)
app.include_router(security_router)

@app.middleware('http')
async def protect_workspace(request: Request, call_next):
    if auth_enabled() and request.method != 'OPTIONS' and request.url.path.startswith('/api/'):
        try:
            if request.method not in {'GET', 'HEAD'}:
                check_origin(request)
            if not request.url.path.startswith('/api/auth/') and request.url.path != '/api/health':
                from .db import engine
                with Session(engine) as db:
                    if not account_for(request, db):
                        return JSONResponse({'detail':'Sign in to access this workspace'}, status_code=401)
        except HTTPException as error:
            return JSONResponse({'detail':error.detail}, status_code=error.status_code)
    return await call_next(request)
frontend_origin = os.getenv('FRONTEND_ORIGIN', 'http://localhost:3000')
allowed_origins = {frontend_origin}
if frontend_origin in {'http://localhost:3000', 'http://127.0.0.1:3000'}:
    allowed_origins.update({'http://localhost:3000', 'http://127.0.0.1:3000'})
app.add_middleware(CORSMiddleware, allow_origins=list(allowed_origins), allow_credentials=True, allow_methods=['GET', 'POST', 'PUT'], allow_headers=['Content-Type', 'X-Setup-Token'])

@app.get('/api/health')
def health():
    return {'status': 'ok', 'generation_mode': os.getenv('GENERATION_MODE', 'demo'), 'publishing_connected': False}

@app.get('/api/series', response_model=list[Series])
def list_series(db: Session = Depends(get_session)):
    return db.exec(select(Series).order_by(Series.id.desc())).all()

@app.post('/api/series', response_model=Series, status_code=201)
def create_series(data: SeriesCreate, db: Session = Depends(get_session)):
    item = Series(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.put('/api/series/{series_id}', response_model=Series)
def update_series(series_id: int, data: SeriesCreate, db: Session = Depends(get_session)):
    item = db.get(Series, series_id)
    if item is None:
        raise HTTPException(404, 'Series not found')
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.put('/api/episodes/{episode_id}/story', response_model=Episode)
def update_story(episode_id: int, data: dict, db: Session = Depends(get_session)):
    from .schemas import Story
    from pydantic import ValidationError
    item = db.get(Episode, episode_id)
    if item is None:
        raise HTTPException(404, 'Episode not found')
    if item.status != 'script_ready':
        raise HTTPException(409, 'Generate the script before editing')
    try:
        story = Story.model_validate(data)
    except ValidationError:
        raise HTTPException(422, 'A story needs a title, synopsis, continuity notes, 3–8 complete scenes, description and hashtags')
    if sum(scene.duration_seconds for scene in story.scenes) > 60:
        raise HTTPException(422, 'Keep the total episode duration at or below 60 seconds')
    new_story = story.model_dump()
    changed = item.story != new_story
    item.story = new_story
    if changed:
        # A review applies to the exact script that was read, not future edits.
        for review in db.exec(select(StudioRecord).where(StudioRecord.kind == 'quality_review')).all():
            if review.data.get('episode_id') == episode_id:
                review.data = {**review.data, 'decision': 'Pending', 'checklist': {}}
                review.updated_at = utcnow()
                db.add(review)
        db.add(StudioEvent(episode_id=episode_id, action='Script updated',
            detail='Script saved; previous quality reviews reset to pending.'))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.get('/api/episodes', response_model=list[Episode])
def list_episodes(db: Session = Depends(get_session)):
    return db.exec(select(Episode).order_by(Episode.publish_at)).all()

@app.post('/api/episodes', response_model=Episode, status_code=201)
def create_episode(data: EpisodeCreate, db: Session = Depends(get_session)):
    if not db.get(Series, data.series_id):
        raise HTTPException(404, 'Series not found')
    item = Episode(series_id=data.series_id, topic=data.topic, publish_at=data.publish_at,
                   generate_at=max(utcnow(), data.publish_at-timedelta(hours=data.lead_hours)))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.post('/api/episodes/{episode_id}/generate', response_model=Episode)
def generate(episode_id: int, db: Session = Depends(get_session)):
    episode = db.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(404, 'Episode not found')
    # Atomic claim prevents concurrent clicks/workers from billing twice.
    claimed = db.execute(update(Episode).where(Episode.id == episode_id,
        Episode.status.in_(['scheduled', 'failed'])).values(status='generating',
        attempts=Episode.attempts+1, error=None))
    db.commit()
    if claimed.rowcount != 1:
        raise HTTPException(409, 'Episode already generated or currently generating')
    db.refresh(episode)
    series = db.get(Series, episode.series_id)
    previous = db.exec(select(Episode).where(Episode.series_id == episode.series_id,
        Episode.id != episode_id, Episode.story.is_not(None)).order_by(Episode.id.desc()).limit(10)).all()
    history = [{'topic': e.topic, 'story': e.story} for e in reversed(previous)]
    try:
        brand = db.get(WorkspaceSetting, 'brand')
        story, mode = generate_story(series, episode, history, brand=brand.data if brand else None)
        episode.story = story.model_dump()
        episode.generation_mode = mode
        episode.status = 'script_ready'
    except Exception:
        logging.exception('Story generation failed for episode %s', episode_id)
        episode.status = 'failed'
        episode.error = 'Story generation failed. Check provider configuration and server logs, then retry.'
    db.add(episode)
    db.add(StudioEvent(episode_id=episode_id,
        action='Story ready' if episode.status == 'script_ready' else 'Story generation failed',
        detail=f'{episode.topic} · attempt {episode.attempts}'))
    db.commit()
    db.refresh(episode)
    return episode
