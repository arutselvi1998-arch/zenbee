import hashlib
import hmac
import os
import secrets
from datetime import timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from .db import get_session, engine
from .models import OwnerAccount, LoginSession, utcnow

router = APIRouter(prefix='/api/auth')
COOKIE = 'zenbee_session'

def enabled():
    return os.getenv('AUTH_REQUIRED', '0') == '1'

def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(24)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 600000).hex()
    return f'{salt}:{hashed}'

def account_for(request, db):
    token = request.cookies.get(COOKIE, '')
    session = db.get(LoginSession, digest(token)) if token else None
    if not session or session.expires_at.replace(tzinfo=timezone.utc) <= utcnow():
        return None
    return db.get(OwnerAccount, session.account_id)

def check_origin(request):
    allowed = {os.getenv('FRONTEND_ORIGIN', 'http://localhost:3000')}
    if allowed & {'http://localhost:3000', 'http://127.0.0.1:3000'}:
        allowed.update({'http://localhost:3000', 'http://127.0.0.1:3000'})
    if request.headers.get('origin') and request.headers['origin'] not in allowed:
        raise HTTPException(403, 'Untrusted request origin')

class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r'^[a-zA-Z0-9_.@+-]+$')
    password: str = Field(min_length=12, max_length=200)

@router.get('/status')
def status(request: Request, db: Session = Depends(get_session)):
    owner = account_for(request, db)
    return {'required': enabled(), 'setup_required': db.exec(select(OwnerAccount)).first() is None,
        'authenticated': owner is not None, 'username': owner.username if owner else None}

def issue(owner, db, response):
    token = secrets.token_urlsafe(48)
    db.add(LoginSession(token_hash=digest(token), account_id=owner.id, expires_at=utcnow()+timedelta(hours=12)))
    db.commit()
    response.set_cookie(COOKIE, token, httponly=True, secure=os.getenv('COOKIE_SECURE', '0') == '1',
        samesite='strict', max_age=43200, path='/')
    return {'authenticated':True, 'username':owner.username}

@router.post('/setup')
def setup(data: Credentials, request: Request, response: Response, db: Session = Depends(get_session)):
    check_origin(request)
    if not enabled():
        raise HTTPException(409, 'Enable AUTH_REQUIRED before creating the workspace owner')
    if db.exec(select(OwnerAccount)).first():
        raise HTTPException(409, 'Workspace owner already exists')
    # Remote bootstrap requires an out-of-band server secret. Local setup is
    # permitted only over a loopback-bound service, as used by start-local.ps1.
    setup_token = os.getenv('OWNER_SETUP_TOKEN')
    if setup_token:
        if not hmac.compare_digest(request.headers.get('X-Setup-Token', ''), setup_token):
            raise HTTPException(403, 'Owner setup token required')
    elif request.client.host not in {'127.0.0.1', '::1', 'testclient'}:
        raise HTTPException(403, 'Create the owner locally or configure OWNER_SETUP_TOKEN')
    owner = OwnerAccount(id=1, username=data.username.lower(), password_hash=password_hash(data.password))
    db.add(owner)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Workspace owner already exists')
    db.refresh(owner)
    return issue(owner, db, response)

@router.post('/login')
def login(data: Credentials, request: Request, response: Response, db: Session = Depends(get_session)):
    check_origin(request)
    owner = db.exec(select(OwnerAccount).where(OwnerAccount.username == data.username.lower())).first()
    if owner and owner.locked_until and owner.locked_until.replace(tzinfo=timezone.utc) > utcnow():
        raise HTTPException(429, 'Too many failed attempts. Try again in 15 minutes')
    stored = owner.password_hash if owner else password_hash('unavailable-account-password')
    if not owner or not hmac.compare_digest(stored, password_hash(data.password, stored.split(':')[0])):
        if owner:
            owner.failed_attempts += 1
            if owner.failed_attempts >= 5:
                owner.locked_until, owner.failed_attempts = utcnow()+timedelta(minutes=15), 0
            db.add(owner)
            db.commit()
        raise HTTPException(401, 'Invalid username or password')
    owner.failed_attempts, owner.locked_until = 0, None
    db.add(owner)
    return issue(owner, db, response)

@router.post('/logout')
def logout(request: Request, response: Response, db: Session = Depends(get_session)):
    check_origin(request)
    token = request.cookies.get(COOKIE)
    session = db.get(LoginSession, digest(token)) if token else None
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie(COOKIE, path='/')
    return {'authenticated':False}
