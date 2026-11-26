from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, get_youtube
from ..models import ChannelSnapshot, User, WatchlistItem
from ..schemas import WatchlistAdd
from ..services import record_snapshot, upsert_channel
from ..youtube import YouTubeClient

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


def _utc_iso(value: datetime) -> str:
    # SQLite hands back naive datetimes; they are UTC, so say so, or browsers read them as local time.
    return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


def _item_out(db: Session, item: WatchlistItem) -> dict:
    latest = db.scalar(select(ChannelSnapshot).where(ChannelSnapshot.channel_id == item.channel_id)
                       .order_by(ChannelSnapshot.day.desc()).limit(1))
    return {
        "channel_id": item.channel_id,
        "title": item.channel.title,
        "handle": item.channel.handle,
        "thumbnail_url": item.channel.thumbnail_url,
        "added_at": _utc_iso(item.added_at),
        "latest": None if latest is None else {"day": latest.day.isoformat(), "subscribers": latest.subscribers,
                                               "views": latest.views, "videos": latest.videos},
    }


@router.get("")
def list_watchlist(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.scalars(select(WatchlistItem).where(WatchlistItem.user_id == user.id)
                       .order_by(WatchlistItem.added_at)).all()
    return {"items": [_item_out(db, i) for i in items]}


@router.post("", status_code=status.HTTP_201_CREATED)
def add(body: WatchlistAdd, response: Response, user: User = Depends(get_current_user),
        db: Session = Depends(get_db), yt: YouTubeClient = Depends(get_youtube)):
    existing = db.scalar(select(WatchlistItem).where(WatchlistItem.user_id == user.id,
                                                     WatchlistItem.channel_id == body.channel_id))
    if existing:
        response.status_code = status.HTTP_200_OK
        return _item_out(db, existing)
    infos = yt.get_channels([body.channel_id])
    if not infos:
        raise HTTPException(404, "Channel not found.")
    upsert_channel(db, infos[0])
    record_snapshot(db, infos[0])
    item = WatchlistItem(user_id=user.id, channel_id=body.channel_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_out(db, item)


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(channel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = db.execute(delete(WatchlistItem).where(WatchlistItem.user_id == user.id,
                                                    WatchlistItem.channel_id == channel_id))
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "That channel isn't on your watchlist.")
