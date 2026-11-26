"""Offline demo mode (DEMO_MODE=true): a fake YouTube API with three made-up channels.

Lets the whole app run, and the end-to-end tests pass, with no API key and no network.
The channels are fictional, so nothing here describes a real creator.
"""
import random
from urllib.parse import quote
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Channel, ChannelSnapshot

# (id suffix letter, title, handle, country, subscribers, total views, video count, base views, upload gap days)
_SPECS = [
    ("o", "Orbit Lab", "@orbitlab", "IN", 2_340_000, 412_000_000, 318, 180_000, 4),
    ("f", "Byte Forge", "@byteforge", "US", 865_000, 96_500_000, 540, 60_000, 2),
    ("m", "Masala Mornings", "@masalamornings", "IN", 1_120_000, 233_000_000, 702, 95_000, 3),
]
_TITLES = {
    "o": ["Why Mars Has Blue Sunsets", "We Built a Cloud Chamber", "How Big Is a Neutron Star?", "The Coldest Place in the Universe",
          "Rockets Explained in 60 Seconds", "What If the Moon Disappeared?", "Inside a Particle Accelerator", "The Sound of Space"],
    "f": ["Rust in 100 Seconds", "I Rewrote My API in Go", "Postgres Indexes Explained", "Docker for Beginners",
          "Build a SaaS in a Weekend", "The Fastest Sorting Algorithm", "Next.js Caching, Finally Explained", "Git Tricks Nobody Uses"],
    "m": ["15-Minute Poha", "Street-Style Pav Bhaji", "Perfect Masala Chai", "Dal Tadka Three Ways",
          "Mumbai Vada Pav at Home", "One-Pot Biryani", "Crispy Dosa Batter Secrets", "Monsoon Pakoras"],
}


_PALETTES = {"o": ("#0ea5e9", "#1e3a8a"), "f": ("#f97316", "#7c2d12"), "m": ("#22c55e", "#14532d")}


def _svg(svg: str) -> str:
    """Images are inline SVG data URIs so demo mode needs no network at all."""
    return "data:image/svg+xml;utf8," + quote(svg)


def avatar(letter: str, title: str) -> str:
    a, b = _PALETTES[letter]
    return _svg(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"><defs><linearGradient id="g" x1="0" y1="0" '
                f'x2="1" y2="1"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'
                f'</defs><rect width="88" height="88" fill="url(#g)"/><text x="44" y="57" font-family="Arial" '
                f'font-size="38" font-weight="700" fill="white" text-anchor="middle">{title[0]}</text></svg>')


def thumbnail(letter: str, i: int, rng: random.Random) -> str:
    a, b = _PALETTES[letter]
    angle = rng.randint(0, 360)
    return _svg(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" '
                f'gradientTransform="rotate({angle} .5 .5)"><stop offset="0" stop-color="{a}"/><stop offset="1" '
                f'stop-color="{b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/>'
                f'<circle cx="{rng.randint(60, 260)}" cy="{rng.randint(40, 140)}" r="{rng.randint(30, 70)}" '
                f'fill="white" fill-opacity="0.18"/><text x="20" y="160" font-family="Arial" font-size="22" '
                f'font-weight="700" fill="white" fill-opacity="0.85">#{i + 1}</text></svg>')


def channel_id(letter: str) -> str:
    return "UC" + "demo" + letter * 18


def _build():
    rng = random.Random(42)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    channels, uploads = {}, {}
    for letter, title, handle, country, subs, views, vcount, base, gap in _SPECS:
        cid = channel_id(letter)
        pid = "UU" + cid[2:]
        channels[cid] = {
            "id": cid,
            "snippet": {"title": title, "customUrl": handle, "country": country,
                        "description": f"{title}: a fictional demo channel.",
                        "publishedAt": "2017-03-14T00:00:00Z",
                        "thumbnails": {"medium": {"url": avatar(letter, title)}}},
            "statistics": {"subscriberCount": str(subs), "viewCount": str(views), "videoCount": str(vcount),
                           "hiddenSubscriberCount": False},
            "contentDetails": {"relatedPlaylists": {"uploads": pid}},
        }
        vids = []
        for i in range(20):
            published = now - timedelta(hours=9) - timedelta(days=i * gap + rng.randint(0, 1))
            short = rng.random() < 0.3
            v = int(base * rng.lognormvariate(0, 0.55) * (0.6 if short else 1) * min(1, (i + 1) / 3))
            likes = int(v * rng.uniform(0.025, 0.06))
            name = _TITLES[letter][i % 8] + ("" if i < 8 else f" (Part {i // 8 + 1})")
            vids.append({
                "id": f"{letter}vid{i:02d}",
                "snippet": {"title": name, "publishedAt": published.strftime("%Y-%m-%dT%H:%M:%SZ"),
                            "thumbnails": {"medium": {"url": thumbnail(letter, i, rng)}}},
                "statistics": {"viewCount": str(v), "likeCount": str(likes), "commentCount": str(int(likes * rng.uniform(0.04, 0.12)))},
                "contentDetails": {"duration": f"PT{rng.randint(25, 59)}S" if short else f"PT{rng.randint(6, 24)}M{rng.randint(0, 59)}S"},
            })
        uploads[pid] = vids
    return channels, uploads


CHANNELS, UPLOADS = _build()
_ALL_VIDEOS = {v["id"]: v for vs in UPLOADS.values() for v in vs}


def handler(request: httpx.Request) -> httpx.Response:
    endpoint = request.url.path.rsplit("/", 1)[-1]
    p = dict(request.url.params)
    if endpoint == "channels":
        if "forHandle" in p:
            h = p["forHandle"].lower()
            items = [c for c in CHANNELS.values() if c["snippet"]["customUrl"] == h]
        else:
            items = [CHANNELS[i] for i in p.get("id", "").split(",") if i in CHANNELS]
        return httpx.Response(200, json={"items": items})
    if endpoint == "search":
        q = p.get("q", "").lower()
        hits = [c for c in CHANNELS.values() if q in c["snippet"]["title"].lower() or q in c["snippet"]["description"].lower()]
        return httpx.Response(200, json={"items": [{"id": {"kind": "youtube#channel", "channelId": c["id"]},
                                                    "snippet": {**c["snippet"], "channelId": c["id"]}} for c in hits]})
    if endpoint == "playlistItems":
        vids = UPLOADS.get(p.get("playlistId", ""))
        if vids is None:
            return httpx.Response(404, json={"error": {"errors": [{"reason": "playlistNotFound"}]}})
        n = int(p.get("maxResults", 20))
        return httpx.Response(200, json={"items": [{"contentDetails": {"videoId": v["id"]}} for v in vids[:n]]})
    if endpoint == "videos":
        return httpx.Response(200, json={"items": [_ALL_VIDEOS[i] for i in p.get("id", "").split(",") if i in _ALL_VIDEOS]})
    return httpx.Response(400, json={"error": {"errors": [{"reason": "badRequest"}]}})


def demo_http() -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def seed_history(db: Session, days: int = 90) -> None:
    """Back-fill 90 days of snapshots so the growth charts have something to draw."""
    if db.scalar(select(ChannelSnapshot.id).limit(1)) is not None:
        return
    rng = random.Random(7)
    today = datetime.now(timezone.utc).date()
    for cid, c in CHANNELS.items():
        sn, st = c["snippet"], c["statistics"]
        db.add(Channel(id=cid, title=sn["title"], handle=sn["customUrl"], thumbnail_url=sn["thumbnails"]["medium"]["url"],
                       uploads_playlist_id=c["contentDetails"]["relatedPlaylists"]["uploads"]))
        subs, views, vids = int(st["subscriberCount"]), int(st["viewCount"]), int(st["videoCount"])
        daily_subs, daily_views = subs * 0.0011, views * 0.0009
        rows = []
        for back in range(1, days + 1):          # walk backwards from yesterday
            subs -= int(daily_subs * rng.uniform(0.4, 1.6))
            views -= int(daily_views * rng.uniform(0.5, 1.5))
            if back % 4 == 0:
                vids -= 1
            rows.append(ChannelSnapshot(channel_id=cid, day=today - timedelta(days=back),
                                        subscribers=subs, views=views, videos=vids))
        db.add_all(rows)
    db.commit()
