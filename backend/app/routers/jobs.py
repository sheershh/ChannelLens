import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_db
from ..deps import get_youtube
from ..services import snapshot_watchlisted
from ..youtube import YouTubeClient

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/snapshot")
def snapshot(x_cron_secret: str = Header(default=""), settings: Settings = Depends(get_settings),
             db: Session = Depends(get_db), yt: YouTubeClient = Depends(get_youtube)):
    """Called once a day by a scheduler (GitHub Actions cron) to build growth history."""
    if not settings.cron_secret:
        raise HTTPException(503, "CRON_SECRET is not configured.")
    if not hmac.compare_digest(x_cron_secret, settings.cron_secret):
        raise HTTPException(403, "Bad cron secret.")
    return snapshot_watchlisted(db, yt)
