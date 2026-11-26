from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import get_db
from .models import User
from .security import COOKIE_NAME, decode_token
from .youtube import YouTubeClient


@lru_cache
def _shared_http(demo: bool) -> httpx.Client:
    if demo:
        from .demo import demo_http
        return demo_http()
    return httpx.Client()


def get_http(settings: Settings = Depends(get_settings)) -> httpx.Client:
    return _shared_http(settings.demo_mode)


def get_youtube(db: Session = Depends(get_db), http: httpx.Client = Depends(get_http),
                settings: Settings = Depends(get_settings)) -> YouTubeClient:
    key = settings.youtube_api_key or ("demo-key" if settings.demo_mode else "")
    return YouTubeClient(db, key, http,
                         cache_ttl=settings.cache_ttl_seconds, daily_quota=settings.daily_quota)


def _token_from(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(COOKIE_NAME)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = _token_from(request)
    user_id = decode_token(token) if token else None
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in.",
                            headers={"WWW-Authenticate": "Bearer"})
    return user
