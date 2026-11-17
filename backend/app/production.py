"""Durable, single-worker storyboard rendering. Paid speech is explicitly opt-in."""
import logging
import os
from pathlib import Path
from datetime import datetime
from typing import Literal
from uuid import UUID
import subprocess
from threading import Event, Thread
import textwrap
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
from .db import engine, get_session
from .models import Episode, ProductionJob, StudioEvent, Series, WorkspaceSetting, AnimationPlan, AnimationClip, utcnow
from .schemas import Story

router = APIRouter(prefix='/api/production')
MEDIA = Path(os.getenv('MEDIA_ROOT', './media')).resolve()

@router.get('/status')
def status():
    return {'worker_enabled': os.getenv('PRODUCTION_WORKER', '0') == '1',
        'renderer': 'storyboard', 'animation_provider':'Runway Gen-4.5',
        'animation_configured':bool(os.getenv('RUNWAYML_API_SECRET')),
        'ai_speech_configured': bool(os.getenv('OPENAI_API_KEY')),
        'automated_stories_enabled': os.getenv('AUTOMATED_STORIES', '0') == '1'}

class RenderRequest(BaseModel):
    episode_id: int
    voice: bool = False
    renderer: Literal['storyboard','animated'] = 'storyboard'
    paid_generation_approved: bool = False

class JobRead(BaseModel):
    id: int
    episode_id: int
    status: str
    attempts: int
    error: str | None
    story_snapshot: dict
    voice: bool
    created_at: datetime
    updated_at: datetime
    renderer: str = 'storyboard'
    clips: list[dict] = Field(default_factory=list)

def read_job(job,db):
    plan=db.get(AnimationPlan,job.id)
    clips=db.exec(select(AnimationClip).where(AnimationClip.job_id == job.id).order_by(AnimationClip.part)).all() if plan else []
    return {**job.model_dump(),'renderer':'animated' if plan else 'storyboard',
        'clips':[c.model_dump() for c in clips]}

@router.get('/jobs', response_model=list[JobRead])
def jobs(db: Session = Depends(get_session)):
    return [read_job(job,db) for job in db.exec(select(ProductionJob).order_by(ProductionJob.id.desc()).limit(100)).all()]

@router.post('/jobs', response_model=JobRead, status_code=201)
def enqueue(data: RenderRequest, db: Session = Depends(get_session)):
    episode = db.get(Episode, data.episode_id)
    if not episode or not episode.story:
        raise HTTPException(422, 'Generate and save a story first')
    if episode.status == 'cancelled':
        raise HTTPException(409, 'Restore this cancelled episode before rendering')
    if data.voice and not os.getenv('OPENAI_API_KEY'):
        raise HTTPException(422, 'Configure OPENAI_API_KEY on the server to use AI speech')
    if data.renderer == 'animated':
        if not data.paid_generation_approved:
            raise HTTPException(422,'Confirm paid video generation before submitting animated scenes')
        if not os.getenv('RUNWAYML_API_SECRET'):
            raise HTTPException(422,'Configure RUNWAYML_API_SECRET on the server for animated video generation')
        if episode.generation_mode == 'demo':
            raise HTTPException(422,'Generate and review a real script first; demo placeholders cannot start paid animation')
    active = db.exec(select(ProductionJob).where(ProductionJob.episode_id == episode.id,
        ProductionJob.status.in_(['queued', 'rendering']))).first()
    if active:
        raise HTTPException(409, 'This episode already has an active render')
    story = Story.model_validate(episode.story)
    job = ProductionJob(episode_id=episode.id, story_snapshot=story.model_dump(), voice=data.voice)
    db.add(job)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'This episode already has an active render')
    if data.renderer == 'animated':
        from .animation import initialize_plan
        series=db.get(Series,episode.series_id)
        profiles=db.get(WorkspaceSetting,'channel_profiles')
        channel=next((p for p in profiles.data['channels'] if p['series_id'] == episode.series_id),{}) if profiles else {}
        initialize_plan(job,{'characters':series.characters,'visual_style':series.visual_style,
            'content_type':channel.get('content_type','cartoon stories'),'language':channel.get('language','Tamil')},db)
    db.add(StudioEvent(episode_id=episode.id, action='Render queued', detail=f'{data.renderer} MP4; voice={data.voice}'))
    db.commit()
    db.refresh(job)
    return read_job(job,db)

class RetryRequest(BaseModel):
    regenerate_failed: bool = False
    retry_speech: bool = False

@router.post('/jobs/{job_id}/retry', response_model=JobRead)
def retry(job_id: int, data: RetryRequest | None = None, db: Session = Depends(get_session)):
    job = db.get(ProductionJob, job_id)
    if not job:
        raise HTTPException(404, 'Job not found')
    if job.status != 'failed':
        raise HTTPException(409, 'Only failed jobs can be retried')
    if job.attempts >= 5:
        raise HTTPException(409, 'Retry limit reached; create a new render after correcting configuration')
    data=data or RetryRequest()
    if db.get(AnimationPlan,job_id):
        clips=db.exec(select(AnimationClip).where(AnimationClip.job_id == job_id)).all()
        if any(c.state in {'creating','uncertain'} for c in clips):
            raise HTTPException(409,'Recover the uncertain provider task ID before retrying; no duplicate paid request will be sent')
        failed=[c for c in clips if c.state == 'provider_failed']
        if failed and not data.regenerate_failed:
            raise HTTPException(422,'Regenerating failed provider scenes may incur new charges. Confirm new-charge consent first.')
        markers=list((MEDIA/str(job_id)).glob('narration-*.requested'))
        if markers and not data.retry_speech:
            raise HTTPException(422,'An earlier speech request may have been charged. Confirm speech retry consent first.')
        for clip in failed:
            clip.state,clip.task_id='pending',None
            db.add(clip)
        for marker in markers:
            marker.unlink()
    job.status, job.error, job.updated_at = 'queued', None, utcnow()
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'Another render for this episode is already active')
    db.refresh(job)
    return read_job(job,db)

class RecoveryRequest(BaseModel):
    clip_id: int
    task_id: UUID

@router.post('/jobs/{job_id}/recover-task')
def recover_task(job_id: int, data: RecoveryRequest, db: Session = Depends(get_session)):
    job=db.get(ProductionJob,job_id)
    clip=db.get(AnimationClip,data.clip_id)
    if not job or job.status != 'failed' or not clip or clip.job_id != job_id or clip.state not in {'creating','uncertain'}:
        raise HTTPException(409,'Only an uncertain scene in a failed job can be recovered')
    import httpx
    from .animation import api_headers, AnimationError
    try:
        with httpx.Client(timeout=45) as client:
            response=client.get('https://api.dev.runwayml.com/v1/tasks/'+str(data.task_id),headers=api_headers())
        if response.status_code != 200 or response.json().get('id') != str(data.task_id):
            raise HTTPException(422,'Runway could not verify this task ID')
    except httpx.HTTPError:
        raise HTTPException(502,'Could not reach Runway; task was not changed')
    except AnimationError as error:
        raise HTTPException(503,str(error))
    clip.task_id,clip.state=str(data.task_id),'submitted'
    db.add(clip);db.commit()
    return {'recovered':True}

@router.get('/jobs/{job_id}/video')
def video(job_id: int, db: Session = Depends(get_session)):
    job = db.get(ProductionJob, job_id)
    path = MEDIA / str(job_id) / 'episode.mp4'
    if not job or job.status != 'completed' or not path.is_file():
        raise HTTPException(404, 'Completed video not found')
    return FileResponse(path, media_type='video/mp4', filename=f'zenbee-{job_id}.mp4')

@router.get('/jobs/{job_id}/captions.{format}')
def captions(job_id: int, format: Literal['vtt','srt'], db: Session = Depends(get_session)):
    import html
    job=db.get(ProductionJob,job_id)
    if not job or job.status != 'completed':
        raise HTTPException(404,'Completed video not found')
    def stamp(seconds):
        return f'{seconds//3600:02}:{seconds%3600//60:02}:{seconds%60:02}' + ('.000' if format == 'vtt' else ',000')
    blocks=['WEBVTT\n'] if format == 'vtt' else []
    elapsed=0
    for index,scene in enumerate(job.story_snapshot['scenes']):
        end=elapsed+scene['duration_seconds']
        content=' '.join((scene.get('caption') or scene.get('narration') or '').split()).replace('-->','→')
        blocks.append(f'{index+1}\n{stamp(elapsed)} --> {stamp(end)}\n{html.escape(content)}\n')
        elapsed=end
    return Response('\n'.join(blocks),media_type='text/vtt' if format == 'vtt' else 'application/x-subrip',
        headers={'Content-Disposition':f'inline; filename="zenbee-{job_id}.{format}"'})

def render(job: ProductionJob):
    import imageio_ffmpeg
    from PIL import Image, ImageDraw, ImageFont
    folder = MEDIA / str(job.id)
    folder.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    font_path = os.getenv('RENDER_FONT', 'C:/Windows/Fonts/arial.ttf' if os.name == 'nt' else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    font = ImageFont.truetype(font_path, 36)
    title_font = ImageFont.truetype(font_path, 52)
    clips = []
    for index, scene in enumerate(job.story_snapshot['scenes']):
        card = Image.new('RGB', (720, 1280), '#170b35')
        draw = ImageDraw.Draw(card)
        draw.rounded_rectangle((30, 30, 690, 1250), 30, fill='#2c1255', outline='#ac6cff', width=3)
        draw.text((65, 80), 'ZENBEE STUDIO', font=title_font, fill='#ffcf4c')
        draw.text((65, 180), f'SCENE {index + 1}', font=font, fill='#c3a2ff')
        title = textwrap.fill(job.story_snapshot['title'], 22)
        draw.multiline_text((65, 270), title, font=title_font, fill='white', spacing=12)
        caption = scene.get('caption') or scene.get('narration') or scene['visual_prompt']
        draw.multiline_text((65, 600), textwrap.fill(caption[:350], 28), font=font, fill='white', spacing=15)
        draw.text((65, 1170), 'Storyboard preview', font=font, fill='#c3a2ff')
        png = folder / f'scene-{index}.png'
        card.save(png)
        clip = folder / f'scene-{index}.mp4'
        duration = scene['duration_seconds']
        command = [ffmpeg, '-y', '-loglevel', 'error', '-loop', '1', '-i', str(png)]
        if job.voice:
            from openai import OpenAI
            speech = folder / f'voice-{index}.mp3'
            with OpenAI(timeout=90, max_retries=0).audio.speech.with_streaming_response.create(
                model=os.getenv('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts'), voice='coral',
                input=(scene.get('narration', '') + ' ' + scene.get('dialogue', '')).strip() or caption,
            ) as response:
                response.stream_to_file(speech)
            command += ['-i', str(speech), '-af', 'apad']
        else:
            command += ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']
        command += ['-t', str(duration), '-r', '24', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', str(clip)]
        subprocess.run(command, check=True, capture_output=True, timeout=180)
        clips.append(clip)
    manifest = folder / 'clips.txt'
    manifest.write_text(''.join(f"file '{clip.name}'\n" for clip in clips), encoding='utf-8')
    temporary = folder / 'output.mp4'
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(manifest),
        '-c', 'copy', '-movflags', '+faststart', str(temporary)], check=True, capture_output=True, timeout=180)
    temporary.replace(folder / 'episode.mp4')

def process_one(bind=engine):
    with Session(bind) as db:
        job = db.exec(select(ProductionJob).where(ProductionJob.status == 'queued').order_by(ProductionJob.id)).first()
        if job is None:
            return False
        claimed = db.execute(update(ProductionJob).where(ProductionJob.id == job.id, ProductionJob.status == 'queued')
            .values(status='rendering', attempts=ProductionJob.attempts + 1, updated_at=utcnow()))
        db.commit()
        if claimed.rowcount != 1:
            return True
        db.refresh(job)
        try:
            plan=db.get(AnimationPlan,job.id)
            if plan:
                from .animation import render_animation
                render_animation(job,plan,db,MEDIA/str(job.id))
            else:
                render(job)
            job.status, job.error = 'completed', None
        except Exception as error:
            from .animation import AnimationError
            logging.exception('Render failed for job %s', job.id)
            job.status, job.error = 'failed', str(error) if isinstance(error,AnimationError) else 'Rendering failed. Check renderer dependencies, provider configuration and server logs before retrying.'
        job.updated_at = utcnow()
        db.add(job)
        db.add(StudioEvent(episode_id=job.episode_id, action='Video ready' if job.status == 'completed' else 'Render failed', detail=f'Production job {job.id}'))
        db.commit()
        return True

def start_worker():
    # Run exactly one application worker. Interrupted jobs require explicit retry,
    # so a crash cannot silently repeat a paid speech request.
    with Session(engine) as db:
        for job in db.exec(select(ProductionJob).where(ProductionJob.status == 'rendering')).all():
            job.status, job.error = 'failed', 'Server stopped during rendering. Retry to resume with a new render.'
            db.add(job)
        db.commit()
    stop = Event()
    def run():
        next_schedule_check = 0
        while not stop.is_set():
            try:
                import time
                if os.getenv('AUTOMATED_SCHEDULES', '0') == '1' and time.monotonic() >= next_schedule_check:
                    from .scheduler import materialize
                    from .models import StudioRecord
                    with Session(engine) as db:
                        for record in db.exec(select(StudioRecord).where(StudioRecord.kind == 'recurring_schedule', StudioRecord.enabled == True)).all():
                            materialize(record, db)
                    next_schedule_check = time.monotonic() + 60
                if os.getenv('AUTOMATED_STORIES', '0') == '1':
                    generate_due_story()
                if process_one():
                    continue
            except Exception:
                logging.exception('Production worker failed')
            stop.wait(2)
    thread = Thread(target=run, daemon=True, name='zenbee-render-worker')
    thread.start()
    return stop

def generate_due_story():
    # Opt-in because story providers may bill each scheduled generation.
    from .main import generate
    with Session(engine) as db:
        episode = db.exec(select(Episode).where(Episode.status == 'scheduled',
            Episode.generate_at <= utcnow()).order_by(Episode.generate_at)).first()
        if episode:
            generate(episode.id, db)
