"""Automatic YouTube landscape thumbnails derived from the finished video."""
import hashlib
import os
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont
from .models import ThumbnailAsset, WorkspaceSetting

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()

def ensure_thumbnail(job, db, folder):
    path=folder/'thumbnail.jpg'
    asset=db.get(ThumbnailAsset,job.id)
    if asset and path.is_file():
        if digest(path) != asset.digest:
            raise RuntimeError('Thumbnail changed; create a fresh render and review before publishing')
        return asset
    import imageio_ffmpeg
    from .media_probe import audio_duration
    video=folder/'episode.mp4'
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    duration=audio_duration(ffmpeg,video)
    timestamp=max(0,min(duration*.35,duration-.1))
    temporary=folder/'thumbnail.pending.jpg'
    filters='split=2[back][front];[back]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,gblur=sigma=28[blur];[front]scale=1280:720:force_original_aspect_ratio=decrease[fit];[blur][fit]overlay=(W-w)/2:(H-h)/2,setsar=1'
    try:
        subprocess.run([ffmpeg,'-y','-loglevel','error','-ss',str(timestamp),'-i',str(video),
            '-filter_complex',filters,'-frames:v','1','-q:v','2',str(temporary)],check=True,capture_output=True,timeout=120)
        profiles=db.get(WorkspaceSetting,'channel_profiles')
        from .models import Episode
        episode=db.get(Episode,job.episode_id)
        profile=next((p for p in profiles.data['channels'] if p['series_id'] == episode.series_id),None) if profiles and episode else None
        label=profile['name'] if profile else 'ZENBEE Studio'
        # Channel badges use Latin text; Tamil captions stay in the video/subtitle
        # pipeline rather than being rendered with an unsupported local font.
        if label.isascii():
            with Image.open(temporary) as source:
                canvas=source.convert('RGB')
            draw=ImageDraw.Draw(canvas)
            font_path=os.getenv('THUMBNAIL_FONT','C:/Windows/Fonts/arialbd.ttf' if os.name=='nt' else '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
            font=ImageFont.truetype(font_path,32)
            label=label[:55]
            width=draw.textbbox((0,0),label,font=font)[2]
            draw.rounded_rectangle((30,630,min(1250,width+70),695),radius=14,fill='#5613a0')
            draw.text((50,642),label,font=font,fill='white')
            canvas.save(temporary,'JPEG',quality=90,optimize=True)
        if temporary.stat().st_size > 2*1024*1024:
            with Image.open(temporary) as source:
                source.convert('RGB').save(temporary,'JPEG',quality=75,optimize=True)
        temporary.replace(path)
        if asset:
            asset.digest=digest(path)
        else:
            asset=ThumbnailAsset(job_id=job.id,digest=digest(path))
        db.add(asset);db.flush()
        return asset
    finally:
        temporary.unlink(missing_ok=True)
