"""Owner-initiated OAuth; encrypted tokens never leave the server."""
import base64
import hashlib
import json
import os
import secrets
from datetime import timedelta, timezone
from typing import Literal
from urllib.parse import urlencode, urlparse
import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import delete
from sqlmodel import Session, select
from .db import get_session
from .models import OAuthAttempt, ProviderConnection, WorkspaceSetting, utcnow, as_utc

router = APIRouter(prefix='/api/connections')
Provider = Literal['google', 'instagram']
GOOGLE_SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/calendar.events'

def cipher():
    key = os.getenv('TOKEN_ENCRYPTION_KEY')
    if not key:
        raise HTTPException(503, 'Configure TOKEN_ENCRYPTION_KEY on the server before connecting accounts')
    try:
        return Fernet(key.encode())
    except ValueError:
        raise HTTPException(503,'TOKEN_ENCRYPTION_KEY is invalid; generate a Fernet key on the server')

def api_base():
    return os.getenv('PUBLIC_API_URL', 'http://localhost:8000').rstrip('/')

def callback_url(provider):
    return f'{api_base()}/api/connections/oauth/{provider}/callback'

def profile_for(key, db):
    saved = db.get(WorkspaceSetting, 'channel_profiles')
    profile = next((p for p in saved.data['channels'] if p['key'] == key), None) if saved else None
    if profile is None:
        raise HTTPException(404, 'Channel plan not found')
    return profile

def find_connection(key, provider, db):
    return db.exec(select(ProviderConnection).where(ProviderConnection.channel_key == key,
        ProviderConnection.provider == provider)).first()

def require_configuration(provider):
    prefix = 'GOOGLE' if provider == 'google' else 'INSTAGRAM'
    if not os.getenv(prefix+'_CLIENT_ID') or not os.getenv(prefix+'_CLIENT_SECRET'):
        raise HTTPException(503, f'Configure {prefix}_CLIENT_ID and {prefix}_CLIENT_SECRET on the server')
    cipher()
    return os.environ[prefix+'_CLIENT_ID'], os.environ[prefix+'_CLIENT_SECRET']

@router.get('/status')
def status(db: Session = Depends(get_session)):
    rows = db.exec(select(ProviderConnection)).all()
    return {'google_configured':bool(os.getenv('GOOGLE_CLIENT_ID') and os.getenv('GOOGLE_CLIENT_SECRET') and os.getenv('TOKEN_ENCRYPTION_KEY')),
        'instagram_configured':bool(os.getenv('INSTAGRAM_CLIENT_ID') and os.getenv('INSTAGRAM_CLIENT_SECRET') and os.getenv('TOKEN_ENCRYPTION_KEY')),
        'automatic_publishing_enabled':os.getenv('AUTOMATED_PUBLISHING','0') == '1',
        'calendar_sync_enabled':os.getenv('GOOGLE_CALENDAR_SYNC','0') == '1',
        'connections':[{'channel_key':r.channel_key,'provider':r.provider,'account_label':r.account_label,
            'expires_at':r.expires_at.isoformat()} for r in rows],
        'redirect_uris':{p:callback_url(p) for p in ['google','instagram']}}

@router.post('/{channel_key}/{provider}/authorize')
def authorize(channel_key: str, provider: Provider, db: Session = Depends(get_session)):
    profile_for(channel_key, db)
    client_id, _ = require_configuration(provider)
    state, verifier = secrets.token_urlsafe(40), secrets.token_urlsafe(48)
    db.add(OAuthAttempt(state_hash=hashlib.sha256(state.encode()).hexdigest(), channel_key=channel_key,
        provider=provider, verifier=verifier, expires_at=utcnow()+timedelta(minutes=10)))
    db.commit()
    params = {'client_id':client_id,'redirect_uri':callback_url(provider),'response_type':'code','state':state}
    if provider == 'google':
        params.update(scope=GOOGLE_SCOPES, access_type='offline', prompt='consent select_account',
            code_challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('='), code_challenge_method='S256')
        url = 'https://accounts.google.com/o/oauth2/v2/auth'
    else:
        params.update(scope='instagram_business_basic,instagram_business_content_publish', force_reauth='true')
        url = 'https://www.instagram.com/oauth/authorize'
    return {'authorization_url':url+'?'+urlencode(params)}

def checked(response):
    # Do not log HTTP exceptions: provider URLs/bodies may include credentials.
    if response.status_code >= 400:
        raise HTTPException(502, 'Provider rejected the request. Check account permissions, application review and quota.')
    return response.json()

def exchange(provider, code, verifier, profile):
    client_id, secret = require_configuration(provider)
    with httpx.Client(timeout=45) as client:
        payload = {'client_id':client_id,'client_secret':secret,'grant_type':'authorization_code',
            'redirect_uri':callback_url(provider),'code':code}
        if provider == 'google':
            payload['code_verifier'] = verifier
            tokens = checked(client.post('https://oauth2.googleapis.com/token', data=payload))
            if not set(GOOGLE_SCOPES.split()).issubset(set(tokens.get('scope','').split())):
                raise HTTPException(422,'Grant YouTube and Calendar permissions to finish connecting')
            data = checked(client.get('https://www.googleapis.com/youtube/v3/channels', params={'part':'snippet','mine':'true'},
                headers={'Authorization':'Bearer '+tokens['access_token']}))
            target = urlparse(profile['youtube_url']).path.strip('/').lower()
            match = next((r for r in data.get('items',[]) if r['snippet'].get('customUrl','').lower().strip('/') == target), None)
            if not match:
                raise HTTPException(422,'The authorized YouTube channel does not match this channel plan. Select the correct Google/Brand account.')
            account_id, label = match['id'], match['snippet']['title']
            if not tokens.get('refresh_token'):
                raise HTTPException(422,'Offline access was not granted; reconnect with consent to allow scheduling')
        else:
            short = checked(client.post('https://api.instagram.com/oauth/access_token', data=payload))
            tokens = checked(client.get('https://graph.instagram.com/access_token',params={
                'grant_type':'ig_exchange_token','client_secret':secret,'access_token':short['access_token']}))
            me = checked(client.get('https://graph.instagram.com/me',params={'fields':'user_id,username'},
                headers={'Authorization':'Bearer '+tokens['access_token']}))
            target = urlparse(profile['instagram_url']).path.strip('/').lower()
            if me.get('username','').lower() != target:
                raise HTTPException(422,'The authorized Instagram username does not match this channel plan')
            account_id, label = str(me.get('user_id') or me['id']), me['username']
        return tokens, account_id, label

@router.get('/oauth/{provider}/callback')
def callback(provider: Provider, state: str = '', code: str = '', error: str = '', db: Session = Depends(get_session)):
    state_hash = hashlib.sha256(state.encode()).hexdigest()
    attempt = db.get(OAuthAttempt, state_hash)
    if not attempt or attempt.provider != provider or as_utc(attempt.expires_at) < utcnow():
        raise HTTPException(400,'Invalid or expired authorization state. Start connection again.')
    claim = db.execute(delete(OAuthAttempt).where(OAuthAttempt.state_hash == state_hash))
    db.commit()
    if claim.rowcount != 1:
        raise HTTPException(400,'Authorization state already used')
    if error or not code:
        raise HTTPException(400,'Account authorization was declined. No connection was saved.')
    try:
        tokens, account_id, label = exchange(provider, code, attempt.verifier, profile_for(attempt.channel_key,db))
        row = find_connection(attempt.channel_key, provider, db)
        values = dict(account_id=account_id,account_label=label,
            encrypted_tokens=cipher().encrypt(json.dumps(tokens).encode()).decode(),
            expires_at=utcnow()+timedelta(seconds=int(tokens.get('expires_in',3600))))
        if not row:
            row = ProviderConnection(channel_key=attempt.channel_key,provider=provider,**values)
        else:
            for key,value in values.items():
                setattr(row,key,value)
        db.add(row)
        db.commit()
    except httpx.HTTPError:
        raise HTTPException(502,'Could not reach the provider. Start connection again.')
    return RedirectResponse(os.getenv('FRONTEND_ORIGIN','http://localhost:3000')+'/?connection=complete',status_code=303)

def access_token(row, db):
    tokens = json.loads(cipher().decrypt(row.encrypted_tokens.encode()))
    remaining = as_utc(row.expires_at)-utcnow()
    refresh = remaining < (timedelta(minutes=5) if row.provider == 'google' else timedelta(days=7))
    if refresh:
        with httpx.Client(timeout=30) as client:
            if row.provider == 'google':
                client_id, secret = require_configuration('google')
                updated = checked(client.post('https://oauth2.googleapis.com/token',data={
                    'client_id':client_id,'client_secret':secret,'refresh_token':tokens['refresh_token'],'grant_type':'refresh_token'}))
            else:
                updated = checked(client.get('https://graph.instagram.com/refresh_access_token',params={
                    'grant_type':'ig_refresh_token','access_token':tokens['access_token']}))
            tokens.update(updated)
            row.encrypted_tokens = cipher().encrypt(json.dumps(tokens).encode()).decode()
            row.expires_at = utcnow()+timedelta(seconds=int(updated['expires_in']))
            db.add(row)
            db.commit()
    return tokens['access_token']
