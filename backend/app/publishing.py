"""Review-gated releases with independent platform receipts and Calendar reminders."""
import hashlib
import hmac
import os
import re
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlparse
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
from . import production
from .connections import access_token, checked, find_connection, profile_for, api_base
from .db import engine, get_session
from .models import Episode, ProductionJob, ScheduledRelease, StudioEvent, utcnow, as_utc
from .scheduler import IST

router = APIRouter(prefix='/api/publishing')

def video_path(job_id):
    return production.MEDIA / str(job_id) / 'episode.mp4'

def media_digest(job_id):
    path = video_path(job_id)
    if not path.is_file():
        raise HTTPException(409,'Render file is missing; render the episode again')
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()

def check_media(release, db):
    job = db.get(ProductionJob, release.job_id)
    episode = db.get(Episode,job.episode_id) if job else None
    if not job or job.status != 'completed' or not episode or episode.status == 'cancelled' or episode.story != job.story_snapshot:
        raise HTTPException(409,'The episode or script changed. Create a fresh render and review.')
    if media_digest(job.id) != release.media_hash:
        raise HTTPException(409,'Video changed after scheduling. Create a fresh release and review.')
    return job, episode

class ReleaseCreate(BaseModel):
    job_id: int
    channel_key: str
    title: str = Field(min_length=1,max_length=100)
    caption: str = Field(min_length=1,max_length=2200)
    made_for_kids: bool
    publish_at: datetime | None = None

    @field_validator('title','caption')
    @classmethod
    def not_blank(cls,value):
        if not value.strip():
            raise ValueError('Enter a nonempty title and caption')
        return value.strip()

    @field_validator('publish_at')
    @classmethod
    def future(cls,value):
        if value is not None and (value.tzinfo is None or value <= utcnow()):
            raise ValueError('Choose a future time with an explicit timezone')
        return value.astimezone(timezone.utc) if value else None

def next_slot(profile, now):
    hour,minute=map(int,profile['publish_time'].split(':'))
    slot=now.astimezone(IST).replace(hour=hour,minute=minute,second=0,microsecond=0)
    if slot <= now:
        slot += timedelta(days=1)
    return slot.astimezone(timezone.utc)

@router.get('/releases', response_model=list[ScheduledRelease])
def list_releases(db: Session = Depends(get_session)):
    return db.exec(select(ScheduledRelease).order_by(ScheduledRelease.publish_at.desc()).limit(100)).all()

@router.post('/releases', response_model=ScheduledRelease, status_code=201)
def create_release(data: ReleaseCreate, db: Session = Depends(get_session)):
    profile = profile_for(data.channel_key,db)
    job = db.get(ProductionJob,data.job_id)
    episode = db.get(Episode,job.episode_id) if job else None
    if not episode or episode.series_id != profile['series_id']:
        raise HTTPException(422,'This video belongs to a different channel or does not exist')
    active = db.exec(select(ScheduledRelease).where(ScheduledRelease.job_id == data.job_id,
        ScheduledRelease.status != 'cancelled')).first()
    if active:
        raise HTTPException(409,'This render already has a release. Cancel it before making a replacement.')
    release = ScheduledRelease(**data.model_dump(exclude={'publish_at'}),publish_at=data.publish_at or next_slot(profile,utcnow()),media_hash=media_digest(data.job_id))
    check_media(release,db)
    db.add(release)
    db.add(StudioEvent(episode_id=episode.id,action='Video review requested',detail=f'{profile["name"]}: {data.title}'))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'This render already has an active release')
    db.refresh(release)
    return release

class Approval(BaseModel):
    reviewed_video_and_metadata: bool

@router.post('/releases/{release_id}/approve', response_model=ScheduledRelease)
def approve(release_id: int, data: Approval, db: Session = Depends(get_session)):
    release = db.get(ScheduledRelease,release_id)
    if not release or release.status != 'pending_review':
        raise HTTPException(409,'Only pending releases can be approved')
    if not data.reviewed_video_and_metadata:
        raise HTTPException(422,'Watch the full video and review title, caption and audience setting first')
    _,episode = check_media(release,db)
    if episode.generation_mode == 'demo':
        raise HTTPException(422,'Demo templates cannot be published. Generate and review real content first.')
    if as_utc(release.publish_at) <= utcnow():
        raise HTTPException(409,'Scheduled time passed. Cancel this release and choose a future slot.')
    claim=db.execute(update(ScheduledRelease).where(ScheduledRelease.id == release.id,
        ScheduledRelease.status == 'pending_review',ScheduledRelease.publish_at > utcnow()).values(status='approved',calendar_status='pending').execution_options(synchronize_session=False))
    db.commit()
    if claim.rowcount != 1:
        raise HTTPException(409,'Release changed or its time passed. Reload before reviewing again.')
    db.refresh(release)
    return release

@router.post('/releases/{release_id}/cancel', response_model=ScheduledRelease)
def cancel(release_id: int, db: Session = Depends(get_session)):
    release=db.get(ScheduledRelease,release_id)
    if not release or release.status not in {'pending_review','approved','held','missed','stale','blocked'}:
        raise HTTPException(409,'This release cannot be cancelled while publishing or after publication')
    claim=db.execute(update(ScheduledRelease).where(ScheduledRelease.id == release.id,
        ScheduledRelease.status.in_(['pending_review','approved','held','missed','stale','blocked'])).values(status='cancelled',calendar_status='pending'))
    db.commit()
    if claim.rowcount != 1:
        raise HTTPException(409,'Release is publishing or already published; cancellation was not applied.')
    db.refresh(release)
    return release

def signed_media_url(release):
    base=api_base()
    if urlparse(base).scheme != 'https' or urlparse(base).hostname in {'localhost','127.0.0.1','::1'}:
        raise HTTPException(503,'Instagram needs PUBLIC_API_URL on a publicly reachable HTTPS host')
    secret=os.getenv('MEDIA_SIGNING_KEY')
    if not secret:
        raise HTTPException(503,'Configure MEDIA_SIGNING_KEY before publishing to Instagram')
    expires=int((utcnow()+timedelta(hours=24)).timestamp())
    value=f'{release.id}:{expires}:{release.media_hash}'
    signature=hmac.new(secret.encode(),value.encode(),'sha256').hexdigest()
    return f'{base}/api/publishing/media/{release.id}?expires={expires}&signature={signature}'

@router.get('/media/{release_id}')
def public_media(release_id: int, expires: int, signature: str, db: Session = Depends(get_session)):
    release=db.get(ScheduledRelease,release_id)
    secret=os.getenv('MEDIA_SIGNING_KEY')
    if not release or not secret or release.status not in {'publishing','published','partial'} or expires < int(utcnow().timestamp()) or expires > int((utcnow()+timedelta(hours=25)).timestamp()):
        raise HTTPException(403,'Invalid media link')
    expected=hmac.new(secret.encode(),f'{release.id}:{expires}:{release.media_hash}'.encode(),'sha256').hexdigest()
    if not hmac.compare_digest(expected,signature):
        raise HTTPException(403,'Invalid media signature')
    check_media(release,db)
    return FileResponse(video_path(release.job_id),media_type='video/mp4')

def sync_calendar(release, db):
    connection=find_connection(release.channel_key,'google',db)
    if not connection:
        return
    token=access_token(connection,db)
    profile=profile_for(release.channel_key,db)
    when=as_utc(release.publish_at)
    event_id=hashlib.sha256(f'zenbee:{release.id}:{release.created_at.isoformat()}'.encode()).hexdigest()
    body={'id':event_id,'summary':f'{profile["name"]}: {release.title}',
        'description':f'YouTube + Instagram. Review status: {release.status}. Publishing is held without approval. Open ZENBEE Studio to review.',
        'start':{'dateTime':when.isoformat(),'timeZone':'Asia/Kolkata'},
        'end':{'dateTime':(when+timedelta(minutes=10)).isoformat(),'timeZone':'Asia/Kolkata'},
        'reminders':{'useDefault':False,'overrides':[{'method':'popup','minutes':15}]}}
    calendar=quote(os.getenv('GOOGLE_CALENDAR_ID','primary'),safe='')
    base=f'https://www.googleapis.com/calendar/v3/calendars/{calendar}/events'
    with httpx.Client(timeout=30) as client:
        headers={'Authorization':'Bearer '+token}
        if release.status == 'cancelled':
            response=client.delete(base+'/'+event_id,headers=headers,params={'sendUpdates':'none'})
            if response.status_code not in {204,404,410}:
                checked(response)
        else:
            response=client.put(base+'/'+event_id,headers=headers,json=body,params={'sendUpdates':'none'})
            if response.status_code == 404:
                response=client.post(base,headers=headers,json=body,params={'sendUpdates':'none'})
                if response.status_code == 409:
                    response=client.put(base+'/'+event_id,headers=headers,json=body,params={'sendUpdates':'none'})
            checked(response)
    release.calendar_status='cancelled' if release.status == 'cancelled' else 'synced'
    db.add(release)
    db.commit()

def upload_youtube(release, token):
    path=video_path(release.job_id)
    with httpx.Client(timeout=180) as client:
        response=client.post('https://www.googleapis.com/upload/youtube/v3/videos',params={'uploadType':'resumable','part':'snippet,status'},
            headers={'Authorization':'Bearer '+token,'X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':str(path.stat().st_size)},
            json={'snippet':{'title':release.title,'description':release.caption,'defaultLanguage':'ta'},
                'status':{'privacyStatus':'public','selfDeclaredMadeForKids':release.made_for_kids,'containsSyntheticMedia':True}})
        if response.status_code >= 400:
            checked(response)
        location=response.headers.get('location','')
        parsed=urlparse(location)
        if parsed.scheme != 'https' or not parsed.hostname or not (parsed.hostname == 'www.googleapis.com' or parsed.hostname.endswith('.googleapis.com')):
            raise HTTPException(502,'Provider did not return a valid upload session')
        with path.open('rb') as stream:
            result=checked(client.put(location,content=stream,headers={'Content-Type':'video/mp4','Content-Length':str(path.stat().st_size)}))
    return {'id':result['id'],'status':'published' if result.get('status',{}).get('privacyStatus') == 'public' else 'uploaded_private'}

def instagram_base():
    version=os.getenv('INSTAGRAM_GRAPH_VERSION','v27.0')
    if not re.fullmatch(r'v\d+\.\d+',version):
        raise HTTPException(503,'Configure a valid Instagram Graph API version')
    return 'https://graph.instagram.com/'+version

def upload_instagram(release, connection, token):
    import time
    base=instagram_base()
    headers={'Authorization':'Bearer '+token}
    with httpx.Client(timeout=60) as client:
        container=checked(client.post(f'{base}/{connection.account_id}/media',headers=headers,json={
            'media_type':'REELS','video_url':signed_media_url(release),'caption':release.caption,'share_to_feed':True}))['id']
        for _ in range(60):
            state=checked(client.get(f'{base}/{container}',headers=headers,params={'fields':'status_code'})).get('status_code')
            if state == 'FINISHED':
                break
            if state in {'ERROR','EXPIRED'}:
                raise HTTPException(502,'Instagram video processing failed; inspect the container before retrying')
            time.sleep(5)
        else:
            raise HTTPException(502,'Instagram processing timed out; inspect the container before retrying')
        result=checked(client.post(f'{base}/{connection.account_id}/media_publish',headers=headers,json={'creation_id':container}))
    return {'id':result['id'],'status':'published'}

def process_release(release, db):
    for provider in ['google','instagram']:
        platform='YouTube' if provider == 'google' else 'Instagram'
        if release.platform_results.get(platform,{}).get('id'):
            continue
        connection=find_connection(release.channel_key,provider,db)
        token=access_token(connection,db)
        result=upload_youtube(release,token) if provider == 'google' else upload_instagram(release,connection,token)
        release.platform_results={**release.platform_results,platform:result}
        db.add(release)
        db.commit()
    release.status='published' if all(r.get('status') == 'published' for r in release.platform_results.values()) else 'partial'
    db.add(release)
    db.add(StudioEvent(action='Publishing result',detail=f'Release {release.id}: {release.status}'))
    db.commit()

def publishing_tick(bind=engine, now=None):
    now=now or utcnow()
    with Session(bind) as db:
        if os.getenv('GOOGLE_CALENDAR_SYNC','0') == '1':
            pending=db.exec(select(ScheduledRelease).where(ScheduledRelease.calendar_status == 'pending').limit(20)).all()
            for release in pending:
                try:
                    sync_calendar(release,db)
                except Exception:
                    # Keep pending for an idempotent Calendar retry. Never log tokens.
                    db.rollback()
        due=db.exec(select(ScheduledRelease).where(ScheduledRelease.publish_at <= now,
            ScheduledRelease.status.in_(['pending_review','approved']))).all()
        for release in due:
            if release.status == 'pending_review':
                release.status,release.error='held','Not approved before the scheduled publishing time. Choose a new slot.'
                db.add(release)
                db.commit()
                continue
            if now-as_utc(release.publish_at) > timedelta(minutes=15):
                release.status,release.error='missed','Scheduled publishing window passed; reschedule and review again.'
                db.add(release)
                db.commit()
                continue
            if os.getenv('AUTOMATED_PUBLISHING','0') != '1':
                continue
            try:
                check_media(release,db)
                for provider in ['google','instagram']:
                    if not find_connection(release.channel_key,provider,db):
                        raise HTTPException(503,'Connect both accounts before the scheduled time')
                signed_media_url(release) # Validate HTTPS hosting before either platform receives a post.
            except HTTPException as error:
                release.status,release.error='blocked',str(error.detail)
                db.add(release)
                db.commit()
                continue
            claim=db.execute(update(ScheduledRelease).where(ScheduledRelease.id == release.id,
                ScheduledRelease.status == 'approved').values(status='publishing'))
            db.commit()
            if claim.rowcount != 1:
                continue
            db.refresh(release)
            try:
                process_release(release,db)
            except Exception:
                db.rollback()
                db.refresh(release)
                release.status,release.error='needs_reconciliation','A provider attempt was interrupted or rejected. Check both platform accounts before retrying; automatic retry is disabled to prevent duplicates.'
                db.add(release)
                db.commit()

def start_publishing_worker():
    from threading import Event, Thread
    with Session(engine) as db:
        for release in db.exec(select(ScheduledRelease).where(ScheduledRelease.status == 'publishing')).all():
            release.status,release.error='needs_reconciliation','Server stopped during publishing. Check platform accounts before any retry.'
            db.add(release)
        db.commit()
    stop=Event()
    def run():
        while not stop.is_set():
            try:
                publishing_tick()
            except Exception as error:
                logging.warning('Publishing worker tick failed (%s); retrying next tick',type(error).__name__)
            stop.wait(15)
    Thread(target=run,daemon=True,name='zenbee-publishing-worker').start()
    return stop
