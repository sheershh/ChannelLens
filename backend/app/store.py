from collections.abc import Callable

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import AppSetting


def get(db: Session, key: str) -> str | None:
    row = db.get(AppSetting, key)
    return row.value if row else None


def put(db: Session, key: str, value: str) -> None:
    db.merge(AppSetting(key=key, value=value))
    db.commit()


def get_or_create(db: Session, key: str, factory: Callable[[], str]) -> str:
    """Return the stored value, creating it once. Safe when two serverless instances race."""
    existing = get(db, key)
    if existing is not None:
        return existing
    db.add(AppSetting(key=key, value=factory()))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()   # another instance stored it first; use theirs
    db.expire_all()
    return get(db, key)
