import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import get_settings

TOKEN_DAYS = 7
COOKIE_NAME = "cl_session"
_cached_secret: str | None = None


def jwt_secret() -> str:
    """JWT_SECRET from the environment, or a random one generated once and kept in the database."""
    global _cached_secret
    if _cached_secret is None:
        secret = get_settings().jwt_secret
        if not secret:
            from . import store
            from .db import SessionLocal, ensure_ready
            ensure_ready()
            with SessionLocal() as db:
                secret = store.get_or_create(db, "jwt_secret", lambda: secrets.token_urlsafe(48))
        _cached_secret = secret
    return _cached_secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(payload, jwt_secret(), algorithm="HS256")


def decode_token(token: str) -> int | None:
    try:
        return int(jwt.decode(token, jwt_secret(), algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
