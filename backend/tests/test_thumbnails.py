import subprocess
from pathlib import Path
from PIL import Image
import imageio_ffmpeg
from test_publishing import workspace, create_release, connect_fixture
from test_workflow import client
from app import publishing, production
from app.models import ScheduledRelease, utcnow
from datetime import timedelta
import httpx
from unittest.mock import Mock

def test_thumbnail_changed_after_review_is_rejected(workspace):
    w=workspace
    release=create_release(w).json()
    (publishing.video_path(w.job.id).parent/'thumbnail.jpg').write_bytes(b'changed thumbnail')
    response=w.client.post(f"/api/publishing/releases/{release['id']}/approve",json={'reviewed_video_and_metadata':True})
    assert response.status_code == 409 and 'Thumbnail changed' in response.text

def test_thumbnail_upload_failure_keeps_video_receipt_and_retry_only_updates_image(workspace,monkeypatch):
    w=workspace
    connect_fixture(w,monkeypatch)
    monkeypatch.setenv('AUTOMATED_PUBLISHING','1')
    video=Mock(return_value={'id':'existing-video','status':'published'})
    monkeypatch.setattr(publishing,'upload_youtube',video)
    monkeypatch.setattr(publishing,'upload_instagram',Mock(return_value={'id':'reel','status':'published'}))
    thumbnail=Mock(side_effect=['failed','uploaded'])
    monkeypatch.setattr(publishing,'upload_youtube_thumbnail',thumbnail)
    release=create_release(w).json()
    w.client.post(f"/api/publishing/releases/{release['id']}/approve",json={'reviewed_video_and_metadata':True})
    publishing.publishing_tick(w.bind,now=utcnow()+timedelta(hours=1,minutes=1))
    result=w.client.get('/api/publishing/releases').json()[0]
    assert result['platform_results']['YouTube']['id'] == 'existing-video'
    assert result['platform_results']['YouTube']['thumbnail_status'] == 'failed'
    assert w.client.post(f"/api/publishing/releases/{release['id']}/retry-thumbnail").json() == {'thumbnail_status':'uploaded'}
    assert video.call_count == 1 and thumbnail.call_count == 2

def test_youtube_thumbnail_set_uses_reviewed_jpeg_and_existing_video_id(workspace,monkeypatch):
    w=workspace
    release=create_release(w).json()
    row=w.db.get(ScheduledRelease,release['id'])
    real_client=httpx.Client
    def handler(request):
        if request.method == 'GET':
            return httpx.Response(200,json={'items':[{'processingDetails':{'processingStatus':'succeeded'}}]})
        assert request.url.path.endswith('/thumbnails/set')
        assert request.url.params['videoId'] == 'already-uploaded'
        assert request.headers['content-type'] == 'image/jpeg'
        assert request.content.startswith(b'\xff\xd8')
        return httpx.Response(200,json={'items':[]})
    monkeypatch.setattr(publishing.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    assert publishing.upload_youtube_thumbnail(row,'already-uploaded','fixture-token',w.db) == 'uploaded'

def test_thumbnail_generation_accepts_long_landscape_video(workspace):
    w=workspace
    from app.models import ThumbnailAsset
    from app.thumbnails import ensure_thumbnail
    asset=w.db.get(ThumbnailAsset,w.job.id);w.db.delete(asset);w.db.commit()
    folder=publishing.video_path(w.job.id).parent
    (folder/'thumbnail.jpg').unlink()
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg,'-y','-loglevel','error','-f','lavfi','-i','color=c=blue:s=320x180:r=1:d=180',
        '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',str(folder/'episode.mp4')],check=True,capture_output=True,timeout=60)
    assert production.backfill_thumbnail(w.bind) is True
    assert production.backfill_thumbnail(w.bind) is False
    with Image.open(folder/'thumbnail.jpg') as image:
        assert image.size == (1280,720)
    assert (folder/'thumbnail.jpg').stat().st_size < 2*1024*1024
