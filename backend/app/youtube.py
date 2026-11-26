"""YouTube Data API v3 client with a database cache and a daily quota guard.

Quota costs (units) per call, from Google's docs. The default budget is 10,000/day,
reset at midnight Pacific time:
    search 100 | channels 1 | playlistItems 1 | videos 1

So the client avoids `search` wherever it can: a channel's recent uploads come from
its uploads playlist (1 unit) instead of a channel-scoped search (100 units).
"""
import hashlib
import json
import re
import time
from datetime import date, datetime
from urllib.parse import unquote, urlparse
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy.orm import Session

from .analytics import parse_duration
from .models import ApiCache, QuotaUsage

BASE_URL = "https://www.googleapis.com/youtube/v3/"
COSTS = {"search": 100, "channels": 1, "playlistItems": 1, "videos": 1}
PACIFIC = ZoneInfo("America/Los_Angeles")
CHANNEL_ID_RE = re.compile(r"^UC[\w-]{22}$")
QUOTA_REASONS = {"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"}


class YouTubeError(Exception):
    status_code = 502

    def __init__(self, message: str, upstream_status: int | None = None):
        super().__init__(message)
        self.upstream_status = upstream_status


class QuotaExceeded(YouTubeError):
    status_code = 429


class NotConfigured(YouTubeError):
    status_code = 503


def quota_day() -> date:
    return datetime.now(PACIFIC).date()


def parse_query(raw: str) -> tuple[str, str]:
    """Classify user input as ('id', UC...), ('handle', @name) or ('search', text).

    Accepts pasted links like youtube.com/@name or youtube.com/channel/UC...
    """
    q = raw.strip()
    if "youtube.com/" in q or "youtu.be/" in q:
        path = unquote(urlparse(q if "://" in q else "https://" + q).path).strip("/")
        parts = path.split("/")
        if parts and parts[0].startswith("@"):
            return "handle", parts[0]
        if len(parts) >= 2 and parts[0] == "channel" and CHANNEL_ID_RE.match(parts[1]):
            return "id", parts[1]
    if CHANNEL_ID_RE.match(q):
        return "id", q
    if q.startswith("@") and " " not in q and len(q) > 1:
        return "handle", q
    return "search", q


def _thumb(snippet: dict) -> str | None:
    thumbs = snippet.get("thumbnails") or {}
    for size in ("medium", "high", "default"):
        if size in thumbs:
            return thumbs[size].get("url")
    return None


def _int(value) -> int | None:
    return int(value) if value is not None else None


def parse_channel(item: dict) -> dict:
    sn, st = item.get("snippet", {}), item.get("statistics", {})
    return {
        "id": item["id"],
        "title": sn.get("title", ""),
        "handle": sn.get("customUrl"),
        "description": sn.get("description", ""),
        "thumbnail_url": _thumb(sn),
        "country": sn.get("country"),
        "published_at": sn.get("publishedAt"),
        "subscribers": None if st.get("hiddenSubscriberCount") else _int(st.get("subscriberCount")),
        "views": _int(st.get("viewCount")) or 0,
        "videos": _int(st.get("videoCount")) or 0,
        "uploads_playlist_id": item.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads"),
    }


def parse_video(item: dict) -> dict:
    sn, st = item.get("snippet", {}), item.get("statistics", {})
    return {
        "id": item["id"],
        "title": sn.get("title", ""),
        "published_at": sn.get("publishedAt"),
        "thumbnail_url": _thumb(sn),
        "views": _int(st.get("viewCount")) or 0,
        "likes": _int(st.get("likeCount")),          # None when the creator hides likes
        "comments": _int(st.get("commentCount")),    # None when comments are off
        "duration_seconds": parse_duration(item.get("contentDetails", {}).get("duration")),
    }


class YouTubeClient:
    def __init__(self, db: Session, api_key: str, http: httpx.Client,
                 cache_ttl: int = 3600, daily_quota: int = 10_000):
        self.db, self.api_key, self.http = db, api_key, http
        self.cache_ttl, self.daily_quota = cache_ttl, daily_quota

    # ---- quota ----
    def units_used_today(self) -> int:
        row = self.db.get(QuotaUsage, quota_day())
        return row.units if row else 0

    def _charge(self, units: int) -> None:
        day = quota_day()
        row = self.db.get(QuotaUsage, day)
        if row is None:
            row = QuotaUsage(day=day, units=0)
            self.db.add(row)
        row.units += units
        self.db.commit()

    # ---- raw call: cache -> quota check -> HTTP -> charge -> cache ----
    def _get(self, endpoint: str, params: dict, *, ttl: int | None = None, fresh: bool = False) -> dict:
        ttl = self.cache_ttl if ttl is None else ttl
        key = hashlib.sha256(f"{endpoint}?{json.dumps(params, sort_keys=True)}".encode()).hexdigest()
        now = int(time.time())
        if not fresh:
            hit = self.db.get(ApiCache, key)
            if hit is not None and hit.expires_at > now:
                return json.loads(hit.payload)

        if not self.api_key:
            raise NotConfigured("YOUTUBE_API_KEY is not set on the server.")
        cost = COSTS[endpoint]
        if self.units_used_today() + cost > self.daily_quota:
            raise QuotaExceeded("Daily YouTube API quota reached. It resets at midnight Pacific time.")

        try:
            resp = self.http.get(BASE_URL + endpoint, params={**params, "key": self.api_key}, timeout=15)
        except httpx.HTTPError as exc:
            raise YouTubeError("Could not reach the YouTube API.") from exc
        self._charge(cost)  # Google bills failed requests too

        if resp.status_code != 200:
            reason = ""
            try:
                reason = resp.json()["error"]["errors"][0]["reason"]
            except (ValueError, KeyError, IndexError, TypeError):
                pass
            if reason in QUOTA_REASONS:
                raise QuotaExceeded("YouTube API quota exceeded. Try again later.", resp.status_code)
            raise YouTubeError(f"YouTube API error {resp.status_code} {reason}".strip(), resp.status_code)

        data = resp.json()
        self.db.merge(ApiCache(key=key, payload=json.dumps(data), expires_at=now + ttl))
        self.db.commit()
        return data

    # ---- public methods ----
    def search_channels(self, query: str, limit: int = 6) -> list[dict]:
        kind, value = parse_query(query)
        if kind == "id":
            items = self._get("channels", {"part": "snippet", "id": value}).get("items", [])
        elif kind == "handle":
            items = self._get("channels", {"part": "snippet", "forHandle": value}).get("items", [])
        else:
            data = self._get("search", {"part": "snippet", "type": "channel", "q": value,
                                        "maxResults": limit}, ttl=24 * 3600)
            return [{
                "id": it["id"]["channelId"],
                "title": it["snippet"].get("title", ""),
                "description": it["snippet"].get("description", ""),
                "thumbnail_url": _thumb(it["snippet"]),
            } for it in data.get("items", []) if it.get("id", {}).get("channelId")]
        return [{
            "id": it["id"],
            "title": it["snippet"].get("title", ""),
            "description": it["snippet"].get("description", ""),
            "thumbnail_url": _thumb(it["snippet"]),
        } for it in items]

    def get_channels(self, ids: list[str], fresh: bool = False) -> list[dict]:
        """Full details for up to any number of channels, 50 per call (1 unit each)."""
        out = []
        for i in range(0, len(ids), 50):
            batch = ids[i:i + 50]
            data = self._get("channels", {"part": "snippet,statistics,contentDetails",
                                          "id": ",".join(batch), "maxResults": 50}, fresh=fresh)
            out += [parse_channel(it) for it in data.get("items", [])]
        return out

    def recent_videos(self, uploads_playlist_id: str | None, limit: int = 20) -> list[dict]:
        if not uploads_playlist_id:
            return []
        try:
            data = self._get("playlistItems", {"part": "contentDetails",
                                               "playlistId": uploads_playlist_id, "maxResults": limit})
        except YouTubeError as exc:
            if exc.upstream_status == 404:   # channel with no public uploads
                return []
            raise
        ids = [it["contentDetails"]["videoId"] for it in data.get("items", [])]
        if not ids:
            return []
        vdata = self._get("videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(ids)})
        videos = [parse_video(v) for v in vdata.get("items", [])]
        return sorted(videos, key=lambda v: v["published_at"] or "", reverse=True)
