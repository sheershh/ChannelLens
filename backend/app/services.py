"""Glue between the YouTube client, the database and analytics."""
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import analytics
from .config import Settings
from .models import Channel, ChannelSnapshot, WatchlistItem
from .youtube import YouTubeClient


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


def upsert_channel(db: Session, info: dict) -> Channel:
    ch = db.get(Channel, info["id"])
    if ch is None:
        ch = Channel(id=info["id"])
        db.add(ch)
    ch.title = info["title"]
    ch.handle = info.get("handle")
    ch.thumbnail_url = info.get("thumbnail_url")
    ch.uploads_playlist_id = info.get("uploads_playlist_id")
    return ch


def record_snapshot(db: Session, info: dict, day: date | None = None) -> None:
    """Store today's numbers for a channel (one row per channel per day; later calls overwrite)."""
    day = day or today_utc()
    snap = db.scalar(select(ChannelSnapshot).where(ChannelSnapshot.channel_id == info["id"],
                                                   ChannelSnapshot.day == day))
    if snap is None:
        snap = ChannelSnapshot(channel_id=info["id"], day=day)
        db.add(snap)
    snap.subscribers, snap.views, snap.videos = info["subscribers"], info["views"], info["videos"]


def history(db: Session, channel_id: str, days: int = 365) -> list[dict]:
    rows = db.scalars(select(ChannelSnapshot).where(ChannelSnapshot.channel_id == channel_id)
                      .order_by(ChannelSnapshot.day.desc()).limit(days)).all()
    return [{"day": r.day, "subscribers": r.subscribers, "views": r.views, "videos": r.videos}
            for r in reversed(rows)]


def channel_report(db: Session, yt: YouTubeClient, settings: Settings, info: dict) -> dict:
    """Everything the dashboard shows for one channel. Caller supplies `info` from get_channels."""
    upsert_channel(db, info)
    record_snapshot(db, info)
    db.commit()
    videos = yt.recent_videos(info["uploads_playlist_id"], settings.recent_videos)
    for v in videos:
        v["engagement_rate"] = analytics.engagement_rate(v)
    snaps = history(db, info["id"])
    return {
        "channel": {k: v for k, v in info.items() if k != "uploads_playlist_id"},
        "summary": analytics.summarize(videos, settings.rpm_low, settings.rpm_high),
        "growth": analytics.growth(snaps, today_utc()),
        "videos": videos,
    }


def snapshot_watchlisted(db: Session, yt: YouTubeClient) -> dict:
    """Daily job: refresh every channel on anyone's watchlist. 1 API unit per 50 channels."""
    ids = list(db.scalars(select(WatchlistItem.channel_id).distinct()))
    before = yt.units_used_today()
    infos = yt.get_channels(ids, fresh=True) if ids else []
    for info in infos:
        upsert_channel(db, info)
        record_snapshot(db, info)
    db.commit()
    return {"channels": len(ids), "snapshots": len(infos), "units_used": yt.units_used_today() - before}
