import re
import subprocess

def audio_duration(ffmpeg, path):
    result=subprocess.run([ffmpeg,'-hide_banner','-i',str(path)],capture_output=True,timeout=30)
    match=re.search(rb'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)',result.stderr)
    if not match:
        raise RuntimeError('Could not measure generated narration duration')
    hours,minutes,seconds=map(float,match.groups())
    return hours*3600+minutes*60+seconds
