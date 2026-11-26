from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_db
from ..deps import get_youtube
from ..services import channel_report, history
from ..youtube import CHANNEL_ID_RE, YouTubeClient

router = APIRouter(tags=["channels"])


def _check_id(channel_id: str) -> str:
    if not CHANNEL_ID_RE.match(channel_id):
        raise HTTPException(422, "Not a valid YouTube channel ID.")
    return channel_id


@router.get("/channels/search")
def search(q: str = Query(min_length=1, max_length=200), yt: YouTubeClient = Depends(get_youtube)):
    """Name search costs 100 quota units (cached 24 h); @handles, IDs and channel URLs cost 1."""
    return {"results": yt.search_channels(q)}


@router.get("/channels/{channel_id}")
def channel(channel_id: str, db: Session = Depends(get_db), yt: YouTubeClient = Depends(get_youtube),
            settings: Settings = Depends(get_settings)):
    infos = yt.get_channels([_check_id(channel_id)])
    if not infos:
        raise HTTPException(404, "Channel not found.")
    return channel_report(db, yt, settings, infos[0])


@router.get("/channels/{channel_id}/history")
def channel_history(channel_id: str, days: int = Query(90, ge=1, le=730), db: Session = Depends(get_db)):
    rows = history(db, _check_id(channel_id), days)
    return {"channel_id": channel_id, "snapshots": [r | {"day": r["day"].isoformat()} for r in rows]}


@router.get("/compare")
def compare(ids: str = Query(description="2 to 4 comma-separated channel IDs"),
            db: Session = Depends(get_db), yt: YouTubeClient = Depends(get_youtube),
            settings: Settings = Depends(get_settings)):
    wanted = list(dict.fromkeys(i.strip() for i in ids.split(",") if i.strip()))
    if not 2 <= len(wanted) <= 4:
        raise HTTPException(422, "Compare between 2 and 4 different channels.")
    for cid in wanted:
        _check_id(cid)
    infos = {i["id"]: i for i in yt.get_channels(wanted)}   # one API call for all of them
    missing = [cid for cid in wanted if cid not in infos]
    if missing:
        raise HTTPException(404, f"Channel not found: {', '.join(missing)}")
    reports = [channel_report(db, yt, settings, infos[cid]) for cid in wanted]
    for r in reports:
        r.pop("videos")   # keep the comparison payload small
    return {"channels": reports}
