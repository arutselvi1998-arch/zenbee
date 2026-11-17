"""Resumable Runway animation tasks and real clip/audio assembly."""
import base64
import math
import os
from pathlib import Path
import subprocess
import time
from urllib.parse import urlparse, urljoin
from uuid import UUID
import httpx
from sqlmodel import Session, select
from .models import AnimationPlan, AnimationClip

class AnimationError(RuntimeError):
    pass

def split_duration(seconds):
    count=math.ceil(seconds/10)
    base,extra=divmod(seconds,count)
    return [base+(i<extra) for i in range(count)]

def initialize_plan(job, context, db):
    db.add(AnimationPlan(job_id=job.id,context=context))
    part=0
    for scene_index,scene in enumerate(job.story_snapshot['scenes']):
        for duration in split_duration(scene['duration_seconds']):
            db.add(AnimationClip(job_id=job.id,part=part,scene_index=scene_index,duration=duration))
            part+=1

def api_headers():
    secret=os.getenv('RUNWAYML_API_SECRET')
    if not secret:
        raise AnimationError('Configure RUNWAYML_API_SECRET on the server before generating animation.')
    return {'Authorization':'Bearer '+secret,'X-Runway-Version':'2024-11-06'}

def bounded_prompt(text):
    # Runway measures its limit in UTF-16 code units.
    return text.encode('utf-16-le')[:2000].decode('utf-16-le',errors='ignore')

def prompt_for(job, plan, clip):
    scene=job.story_snapshot['scenes'][clip.scene_index]
    technical=plan.context.get('content_type') == 'technical'
    style='Clear animated technical educational visualization. Accurate objects and readable motion.' if technical else 'Polished colorful 3D cartoon animation, expressive original characters, warm lighting, child-friendly.'
    return bounded_prompt(f"{style} Vertical 9:16. Keep the same character appearance and clothing across shots. "
        f"Cast: {str(plan.context.get('characters',''))[:220]}. Style: {str(plan.context.get('visual_style',''))[:120]}. "
        f"Scene action: {scene['visual_prompt'][:500]}. Animate the action naturally; no title cards, subtitles, logos or written text. "
        f"Continue the reference image when supplied. Scene {clip.scene_index+1}, shot {clip.part+1}.")

def submit_clip(job, plan, clip, reference, db):
    if clip.state in {'creating','uncertain'}:
        raise AnimationError('A previous task submission has an uncertain result. Recover its task ID from Runway before retrying; it will not be submitted twice.')
    clip.state='creating'
    db.add(clip);db.commit()
    payload={'model':plan.model,'promptText':prompt_for(job,plan,clip),'ratio':'720:1280',
        'duration':max(2,clip.duration),'seed':job.id % 4294967296}
    endpoint='text_to_video'
    if reference:
        payload['promptImage']='data:image/jpeg;base64,'+base64.b64encode(reference.read_bytes()).decode()
        endpoint='image_to_video'
    try:
        with httpx.Client(timeout=90) as client:
            response=client.post('https://api.dev.runwayml.com/v1/'+endpoint,headers=api_headers(),json=payload)
        if response.status_code >= 400:
            clip.state='provider_failed';db.add(clip);db.commit()
            raise AnimationError('Runway rejected the scene request. Check credits, account/model access and moderation before retrying with new-charge consent.')
        task_id=str(UUID(response.json()['id']))
    except AnimationError:
        raise
    except Exception:
        clip.state='uncertain';db.add(clip);db.commit()
        raise AnimationError('Runway task submission was interrupted. Check the provider dashboard and recover its task ID; automatic resubmission is disabled.') from None
    clip.task_id,clip.state=task_id,'submitted'
    db.add(clip);db.commit()

def poll_clip(clip, db):
    deadline=time.monotonic()+1800
    with httpx.Client(timeout=45) as client:
        while time.monotonic() < deadline:
            try:
                response=client.get('https://api.dev.runwayml.com/v1/tasks/'+str(UUID(clip.task_id)),headers=api_headers())
                if response.status_code == 429 or response.status_code >= 500:
                    time.sleep(10);continue
                if response.status_code >= 400:
                    raise AnimationError('Could not retrieve the saved Runway task. Check access and credits, then retry to resume.')
                task=response.json()
                state=task['status']
            except httpx.HTTPError:
                raise AnimationError('Runway polling was interrupted. Retry to resume the saved task without creating a new charge.') from None
            if state == 'SUCCEEDED':
                outputs=task.get('output') or []
                if not outputs:
                    raise AnimationError('Runway completed without a downloadable video.')
                return outputs[0]
            if state in {'FAILED','CANCELLED'}:
                clip.state='provider_failed';db.add(clip);db.commit()
                raise AnimationError('Runway could not generate this scene. Review its prompt and account status; regenerating requires new-charge consent.')
            if state not in {'PENDING','THROTTLED','RUNNING'}:
                raise AnimationError('Runway returned an unknown task state. Retry later to check the existing task.')
            if clip.state != state.lower():
                clip.state=state.lower();db.add(clip);db.commit()
            time.sleep(5)
    raise AnimationError('Scene generation is still pending after 30 minutes. Retry to resume the same Runway task.')

def allowed_output(url):
    parsed=urlparse(url)
    domains=('runwayml.com','runway.com','cloudfront.net','amazonaws.com')
    if parsed.scheme != 'https' or parsed.username or not parsed.hostname or parsed.port not in {None,443} or not any(parsed.hostname == d or parsed.hostname.endswith('.'+d) for d in domains):
        raise AnimationError('Provider returned an unrecognized download host. No file was downloaded.')

def download_clip(url, path):
    # Never send the API secret to a CDN or follow an unchecked redirect.
    temporary=path.with_suffix('.download')
    limit=256*1024*1024
    try:
        with httpx.Client(timeout=180) as client:
            for _ in range(4):
                allowed_output(url)
                with client.stream('GET',url) as response:
                    if response.status_code in {301,302,303,307,308}:
                        url=urljoin(url,response.headers.get('location',''));continue
                    if response.status_code != 200:
                        raise AnimationError('Video download failed. Retry to fetch the same completed provider task.')
                    if int(response.headers.get('content-length','0')) > limit:
                        raise AnimationError('Provider clip exceeds the download size limit.')
                    size=0
                    with temporary.open('wb') as stream:
                        for block in response.iter_bytes():
                            size+=len(block)
                            if size > limit:
                                raise AnimationError('Provider clip exceeds the download size limit.')
                            stream.write(block)
                    if size < 32:
                        raise AnimationError('Provider returned an empty or invalid video.')
                    temporary.replace(path)
                    return
            raise AnimationError('Provider download redirected too many times.')
    except httpx.HTTPError:
        raise AnimationError('Clip download was interrupted. Retry to resume the existing task.') from None
    finally:
        temporary.unlink(missing_ok=True)

def ffmpeg_run(ffmpeg, args):
    try:
        subprocess.run([ffmpeg,'-y','-loglevel','error',*args],check=True,capture_output=True,timeout=300)
    except subprocess.SubprocessError:
        raise AnimationError('Video assembly failed. Generated clips are saved; retry to assemble without regenerating them.') from None

def extract_reference(ffmpeg, source, target, duration):
    ffmpeg_run(ffmpeg,['-ss',str(max(0,duration-.05)),'-i',str(source),'-frames:v','1','-q:v','3','-update','1',str(target)])

def speech_file(job, index, folder):
    from openai import OpenAI
    scene=job.story_snapshot['scenes'][index]
    text=(scene.get('narration','')+' '+scene.get('dialogue','')).strip()
    if not text:
        return None
    path=folder/f'narration-{index}.mp3'
    if path.exists():
        return path
    marker=folder/f'narration-{index}.requested'
    if marker.exists():
        raise AnimationError('A speech request was interrupted. Check OpenAI usage before allowing that speech request again.')
    marker.touch()
    try:
        with OpenAI(timeout=120,max_retries=0).audio.speech.with_streaming_response.create(
            model=os.getenv('OPENAI_TTS_MODEL','gpt-4o-mini-tts'),voice=os.getenv('OPENAI_TTS_VOICE','coral'),
            input=text,instructions='Speak naturally in Tamil. Keep every word clear. Do not add words or translate the script.') as response:
            response.stream_to_file(path.with_suffix('.partial'))
        path.with_suffix('.partial').replace(path)
        marker.unlink()
        return path
    except Exception:
        raise AnimationError('Tamil speech generation was interrupted. Check OpenAI usage; no automatic billed retry was made.') from None

def render_animation(job, plan, db, folder):
    import imageio_ffmpeg
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    folder.mkdir(parents=True,exist_ok=True)
    clips=db.exec(select(AnimationClip).where(AnimationClip.job_id == job.id).order_by(AnimationClip.part)).all()
    reference=None
    for clip in clips:
        raw=folder/f'raw-{clip.part}.mp4'
        if not raw.is_file():
            if clip.state == 'provider_failed':
                raise AnimationError('A scene failed at the provider. Explicit new-charge consent is required to regenerate it.')
            if not clip.task_id:
                submit_clip(job,plan,clip,reference,db)
            url=poll_clip(clip,db)
            download_clip(url,raw)
        reference=folder/f'reference-{clip.part}.jpg'
        from .media_probe import audio_duration
        if audio_duration(ffmpeg,raw)+.1 < clip.duration:
            raise AnimationError('Provider video is shorter than the requested scene. Inspect the saved clip before continuing.')
        extract_reference(ffmpeg,raw,reference,clip.duration)
        clip.state='downloaded';db.add(clip);db.commit()
    scene_outputs=[]
    for index,scene in enumerate(job.story_snapshot['scenes']):
        parts=[c for c in clips if c.scene_index == index]
        normalized=[]
        for part in parts:
            target=folder/f'normalized-{part.part}.mp4'
            ffmpeg_run(ffmpeg,['-i',str(folder/f'raw-{part.part}.mp4'),'-an','-t',str(part.duration),
                '-vf','scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=24',
                '-c:v','libx264','-preset','fast','-pix_fmt','yuv420p',str(target)])
            normalized.append(target)
        listing=folder/f'scene-{index}-parts.txt'
        listing.write_text(''.join(f"file '{p.name}'\n" for p in normalized),encoding='utf-8')
        visuals=folder/f'scene-{index}-visual.mp4'
        ffmpeg_run(ffmpeg,['-f','concat','-safe','0','-i',str(listing),'-c','copy',str(visuals)])
        output=folder/f'scene-{index}.mp4'
        speech=speech_file(job,index,folder) if job.voice else None
        audio=['-i',str(speech),'-af','apad'] if speech else ['-f','lavfi','-i','anullsrc=r=44100:cl=stereo']
        # Reject an overlong voice track instead of cutting words mid-sentence.
        duration=scene['duration_seconds']
        if speech:
            from .media_probe import audio_duration
            spoken=audio_duration(ffmpeg,speech)
            if spoken > duration:
                raise AnimationError('Tamil narration is longer than its scene. Shorten the narration or increase its duration and create a new reviewed render; generated clips remain saved.')
        ffmpeg_run(ffmpeg,['-i',str(visuals),*audio,'-t',str(duration),'-map','0:v:0','-map','1:a:0',
            '-c:v','copy','-c:a','aac','-ar','44100','-ac','2','-shortest',str(output)])
        scene_outputs.append(output)
    listing=folder/'animated-scenes.txt'
    listing.write_text(''.join(f"file '{p.name}'\n" for p in scene_outputs),encoding='utf-8')
    pending=folder/'animated-output.mp4'
    ffmpeg_run(ffmpeg,['-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(pending)])
    pending.replace(folder/'episode.mp4')
