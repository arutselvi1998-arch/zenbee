import os
from dotenv import load_dotenv
from sqlmodel import SQLModel, Session, create_engine

load_dotenv()
url = os.getenv('DATABASE_URL', 'sqlite:///./zenbee.db')
engine = create_engine(url, connect_args={'check_same_thread': False} if url.startswith('sqlite') else {}, pool_pre_ping=True)

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
    # Add the release uniqueness index when upgrading an existing workspace.
    from .models import ScheduledRelease
    for index in ScheduledRelease.__table__.indexes:
        if index.name == 'uq_release_active_job':
            index.create(engine, checkfirst=True)
