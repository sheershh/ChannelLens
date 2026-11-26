"""An in-memory stand-in for the YouTube Data API, plugged in via httpx.MockTransport."""
from datetime import datetime, timedelta, timezone

import httpx

ALPHA = "UC" + "a" * 22
BETA = "UC" + "b" * 22
EMPTY = "UC" + "e" * 22


def _video(vid, days_ago, views, likes, comments, duration):
    published = (datetime(2026, 11, 20, tzinfo=timezone.utc) - timedelta(days=days_ago))
    return {"id": vid,
            "snippet": {"title": f"Video {vid}", "publishedAt": published.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "thumbnails": {"medium": {"url": f"https://i.ytimg.com/{vid}.jpg"}}},
            "statistics": {k: str(v) for k, v in
                           (("viewCount", views), ("likeCount", likes), ("commentCount", comments)) if v is not None},
            "contentDetails": {"duration": duration}}


class FakeYouTube:
    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self.fail_reason: str | None = None
        self.channels = {
            ALPHA: {"id": ALPHA,
                    "snippet": {"title": "Alpha Science", "customUrl": "@alphascience", "description": "Science",
                                "thumbnails": {"medium": {"url": "https://yt3/alpha.jpg"}}, "country": "IN",
                                "publishedAt": "2015-01-01T00:00:00Z"},
                    "statistics": {"viewCount": "300000000", "subscriberCount": "1200000", "videoCount": "500",
                                   "hiddenSubscriberCount": False},
                    "contentDetails": {"relatedPlaylists": {"uploads": "UU" + "a" * 22}}},
            BETA: {"id": BETA,
                   "snippet": {"title": "Beta Builds", "customUrl": "@betabuilds",
                               "thumbnails": {"default": {"url": "https://yt3/beta.jpg"}}},
                   "statistics": {"viewCount": "5000000", "videoCount": "80", "hiddenSubscriberCount": True},
                   "contentDetails": {"relatedPlaylists": {"uploads": "UU" + "b" * 22}}},
            EMPTY: {"id": EMPTY, "snippet": {"title": "Empty Channel"},
                    "statistics": {"viewCount": "0", "subscriberCount": "3", "videoCount": "0"},
                    "contentDetails": {"relatedPlaylists": {"uploads": "UU" + "e" * 22}}},
        }
        self.videos = {
            "UU" + "a" * 22: [
                _video("a1", 0, 100_000, 5_000, 1_000, "PT12M30S"),
                _video("a2", 7, 50_000, 2_000, 500, "PT58S"),
                _video("a3", 14, 150_000, 6_000, 1_500, "PT1H2M"),
                _video("a4", 21, 100_000, None, 300, "PT9M"),   # likes hidden
            ],
            "UU" + "b" * 22: [_video("b1", 3, 20_000, 800, 40, "PT2M")],
        }

    def count(self, endpoint: str) -> int:
        return sum(1 for e, _ in self.calls if e == endpoint)

    def handler(self, request: httpx.Request) -> httpx.Response:
        endpoint = request.url.path.rsplit("/", 1)[-1]
        params = dict(request.url.params)
        self.calls.append((endpoint, params))
        if self.fail_reason:
            return httpx.Response(403, json={"error": {"code": 403, "errors": [{"reason": self.fail_reason}]}})
        assert params.get("key") == "test-key"

        if endpoint == "channels":
            if "forHandle" in params:
                h = params["forHandle"].lower()
                items = [c for c in self.channels.values() if c["snippet"].get("customUrl") == h]
            else:
                items = [self.channels[i] for i in params["id"].split(",") if i in self.channels]
            return httpx.Response(200, json={"items": items})
        if endpoint == "search":
            q = params["q"].lower()
            items = [{"id": {"kind": "youtube#channel", "channelId": c["id"]},
                      "snippet": {**c["snippet"], "channelId": c["id"]}}
                     for c in self.channels.values() if q in c["snippet"]["title"].lower()]
            return httpx.Response(200, json={"items": items})
        if endpoint == "playlistItems":
            pid = params["playlistId"]
            if pid not in self.videos:
                return httpx.Response(404, json={"error": {"code": 404, "errors": [{"reason": "playlistNotFound"}]}})
            return httpx.Response(200, json={"items": [{"contentDetails": {"videoId": v["id"]}}
                                                       for v in self.videos[pid]]})
        if endpoint == "videos":
            wanted = params["id"].split(",")
            allv = {v["id"]: v for vs in self.videos.values() for v in vs}
            return httpx.Response(200, json={"items": [allv[i] for i in wanted if i in allv]})
        return httpx.Response(400, json={"error": {"errors": [{"reason": "badRequest"}]}})
