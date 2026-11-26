"""Pure functions: no I/O, so they're easy to test."""
import re
import statistics
from datetime import date, datetime, timedelta

_DURATION_RE = re.compile(r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")
SHORT_FORM_SECONDS = 180  # YouTube Shorts can be up to 3 minutes


def parse_duration(iso: str | None) -> int:
    """ISO-8601 duration from the API ('PT1H2M3S') to seconds."""
    m = _DURATION_RE.match(iso or "")
    if not m:
        return 0
    d, h, mi, s = (int(x) if x else 0 for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _published(video: dict) -> datetime | None:
    raw = video.get("published_at")
    if not raw:
        return None
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def engagement_rate(video: dict) -> float | None:
    """(likes + comments) / views, as a percentage. None if likes are hidden or no views."""
    if not video.get("views") or video.get("likes") is None:
        return None
    return (video["likes"] + (video.get("comments") or 0)) / video["views"] * 100


def summarize(videos: list[dict], rpm_low: float = 1.0, rpm_high: float = 4.0) -> dict:
    """Stats over a channel's recent uploads."""
    if not videos:
        return {"sample_size": 0, "avg_views": 0, "median_views": 0, "engagement_rate": None,
                "uploads_per_week": None, "short_form_share": None, "top_video_id": None,
                "est_revenue_usd": {"low": 0.0, "high": 0.0}}

    views = [v["views"] for v in videos]
    rated = [v for v in videos if engagement_rate(v) is not None]
    rated_views = sum(v["views"] for v in rated)
    eng = (sum(v["likes"] + (v.get("comments") or 0) for v in rated) / rated_views * 100) if rated_views else None

    dates = sorted(d for d in (_published(v) for v in videos) if d)
    per_week = None
    if len(dates) >= 2:
        span_days = max((dates[-1] - dates[0]).total_seconds() / 86400, 1)
        per_week = round((len(dates) - 1) / span_days * 7, 2)

    total = sum(views)
    return {
        "sample_size": len(videos),
        "avg_views": round(total / len(videos)),
        "median_views": round(statistics.median(views)),
        "engagement_rate": round(eng, 2) if eng is not None else None,
        "uploads_per_week": per_week,
        "short_form_share": round(sum(1 for v in videos if 0 < v["duration_seconds"] <= SHORT_FORM_SECONDS)
                                  / len(videos), 2),
        "top_video_id": max(videos, key=lambda v: v["views"])["id"],
        "est_revenue_usd": {"low": round(total / 1000 * rpm_low, 2), "high": round(total / 1000 * rpm_high, 2)},
    }


def growth(snapshots: list[dict], today: date) -> dict:
    """Deltas from stored daily snapshots. Each snapshot: {day, subscribers, views, videos}."""
    snaps = sorted(snapshots, key=lambda s: s["day"])
    out = {"days_tracked": len(snaps), "since": snaps[0]["day"].isoformat() if snaps else None}
    if not snaps:
        return out | {"d7": None, "d30": None}
    latest = snaps[-1]

    def delta(days: int):
        cutoff = today - timedelta(days=days)
        base = [s for s in snaps if s["day"] <= cutoff]
        if not base:
            return None
        b = base[-1]
        subs = (latest["subscribers"] - b["subscribers"]
                if latest["subscribers"] is not None and b["subscribers"] is not None else None)
        return {"from": b["day"].isoformat(), "subscribers": subs, "views": latest["views"] - b["views"],
                "videos": latest["videos"] - b["videos"]}

    return out | {"d7": delta(7), "d30": delta(30)}
