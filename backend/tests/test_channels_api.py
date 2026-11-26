from tests.fake_youtube import ALPHA, BETA, EMPTY


def test_search(client):
    r = client.get("/api/channels/search", params={"q": "alpha"})
    assert r.status_code == 200 and r.json()["results"][0]["id"] == ALPHA


def test_channel_report(client, yt):
    r = client.get(f"/api/channels/{ALPHA}")
    assert r.status_code == 200
    body = r.json()
    assert body["channel"]["title"] == "Alpha Science" and "uploads_playlist_id" not in body["channel"]
    assert body["summary"]["engagement_rate"] == 5.33 and body["summary"]["top_video_id"] == "a3"
    assert len(body["videos"]) == 4 and body["videos"][0]["engagement_rate"] == 6.0
    assert body["growth"]["days_tracked"] == 1        # first visit records today's snapshot
    assert (yt.count("channels"), yt.count("playlistItems"), yt.count("videos"), yt.count("search")) == (1, 1, 1, 0)
    assert client.get("/api/health").json()["quota_used_today"] == 3   # the old Streamlit app spent ~202


def test_second_visit_is_served_from_cache(client, yt):
    client.get(f"/api/channels/{ALPHA}")
    calls = len(yt.calls)
    assert client.get(f"/api/channels/{ALPHA}").status_code == 200
    assert len(yt.calls) == calls
    assert client.get(f"/api/channels/{ALPHA}/history").json()["snapshots"][0]["subscribers"] == 1_200_000


def test_channel_without_uploads(client):
    body = client.get(f"/api/channels/{EMPTY}").json()
    assert body["videos"] == [] and body["summary"]["sample_size"] == 0


def test_unknown_and_invalid_channel(client):
    assert client.get("/api/channels/UC" + "z" * 22).status_code == 404
    assert client.get("/api/channels/not-an-id").status_code == 422


def test_compare(client, yt):
    r = client.get("/api/compare", params={"ids": f"{ALPHA},{BETA}"})
    assert r.status_code == 200
    chans = r.json()["channels"]
    assert [c["channel"]["id"] for c in chans] == [ALPHA, BETA]
    assert "videos" not in chans[0]
    assert chans[1]["channel"]["subscribers"] is None
    assert yt.count("channels") == 1                  # both channels in one call


def test_compare_validation(client):
    assert client.get("/api/compare", params={"ids": ALPHA}).status_code == 422
    assert client.get("/api/compare", params={"ids": f"{ALPHA},{ALPHA}"}).status_code == 422
    five = ",".join([ALPHA, BETA, EMPTY, "UC" + "c" * 22, "UC" + "d" * 22])
    assert client.get("/api/compare", params={"ids": five}).status_code == 422
    assert client.get("/api/compare", params={"ids": f"{ALPHA},UC{'z' * 22}"}).status_code == 404


def test_quota_exhausted_returns_429(client, yt):
    yt.fail_reason = "quotaExceeded"
    r = client.get(f"/api/channels/{ALPHA}")
    assert r.status_code == 429 and "quota" in r.json()["detail"].lower()
