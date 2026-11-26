import hmac

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import store
from ..config import Settings, get_settings
from ..db import get_db
from ..deps import get_youtube
from ..services import snapshot_watchlisted, today_utc
from ..youtube import YouTubeClient

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _given_secret(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.headers.get("x-cron-secret", "")


@router.api_route("/snapshot", methods=["GET", "POST"])
def snapshot(request: Request, settings: Settings = Depends(get_settings),
             db: Session = Depends(get_db), yt: YouTubeClient = Depends(get_youtube)):
    """Daily job (Vercel Cron sends GET). Records one snapshot per watched channel.

    With CRON_SECRET set, callers must send it (Authorization: Bearer ... or X-Cron-Secret).
    Without it, the job is public but runs at most once per UTC day, so calling it again costs nothing.
    """
    today = today_utc().isoformat()
    if settings.cron_secret:
        if not hmac.compare_digest(_given_secret(request), settings.cron_secret):
            raise HTTPException(403, "Bad cron secret.")
    elif store.get(db, "last_snapshot_day") == today:
        return {"skipped": True, "reason": "Already ran today."}
    result = snapshot_watchlisted(db, yt)
    store.put(db, "last_snapshot_day", today)
    return result
