"""Run from backend/: python ../scripts/configure-channels.py --start-date YYYY-MM-DD"""
import argparse
from datetime import date
from pathlib import Path
from sqlmodel import Session
from app.db import engine, init_db
from app.channels import configure_from_file

parser = argparse.ArgumentParser()
parser.add_argument('--start-date', required=True, type=date.fromisoformat)
args = parser.parse_args()
init_db()
with Session(engine) as db:
    profiles = configure_from_file(Path(__file__).resolve().parents[1] / 'config/channels.json', db, args.start_date)
    for profile in profiles:
        print(f"{profile['name']}: daily {profile['publish_time']} Asia/Kolkata; series {profile['series_id']}, schedule {profile['schedule_id']}")
print('Plans saved. No provider calls, Calendar events or social posts were made.')
