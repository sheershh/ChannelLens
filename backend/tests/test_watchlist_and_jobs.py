from datetime import date

from app.models import ChannelSnapshot
from tests.conftest import signup
from tests.fake_youtube import ALPHA, BETA

CRON = {"X-Cron-Secret": "cron-secret"}


def test_watchlist_requires_login(client):
    assert client.get("/api/watchlist").status_code == 401
    assert client.post("/api/watchlist", json={"channel_id": ALPHA}).status_code == 401


def test_add_list_remove(client):
    h = signup(client)
    r = client.post("/api/watchlist", json={"channel_id": ALPHA}, headers=h)
    assert r.status_code == 201 and r.json()["latest"]["subscribers"] == 1_200_000
    assert r.json()["added_at"].endswith("+00:00")   # explicit UTC, or browsers shift it to local time
    assert client.post("/api/watchlist", json={"channel_id": ALPHA}, headers=h).status_code == 200  # idempotent
    items = client.get("/api/watchlist", headers=h).json()["items"]
    assert [i["channel_id"] for i in items] == [ALPHA]
    assert client.delete(f"/api/watchlist/{ALPHA}", headers=h).status_code == 204
    assert client.delete(f"/api/watchlist/{ALPHA}", headers=h).status_code == 404
    assert client.get("/api/watchlist", headers=h).json()["items"] == []


def test_watchlists_are_private(client):
    a = signup(client, "a@example.com")
    client.cookies.clear()
    b = signup(client, "b@example.com")
    client.cookies.clear()
    client.post("/api/watchlist", json={"channel_id": ALPHA}, headers=a)
    assert client.get("/api/watchlist", headers=b).json()["items"] == []
    assert client.delete(f"/api/watchlist/{ALPHA}", headers=b).status_code == 404


def test_add_validation(client):
    h = signup(client)
    assert client.post("/api/watchlist", json={"channel_id": "nope"}, headers=h).status_code == 422
    assert client.post("/api/watchlist", json={"channel_id": "UC" + "z" * 22}, headers=h).status_code == 404


def test_snapshot_job_auth(client):
    assert client.post("/api/jobs/snapshot").status_code == 403
    assert client.post("/api/jobs/snapshot", headers={"X-Cron-Secret": "wrong"}).status_code == 403


def test_snapshot_job_refreshes_all_watched_channels_in_one_call(client, yt, db):
    a = signup(client, "a@example.com")
    client.cookies.clear()
    b = signup(client, "b@example.com")
    for h, cid in ((a, ALPHA), (a, BETA), (b, ALPHA)):
        client.post("/api/watchlist", json={"channel_id": cid}, headers=h)
    before = yt.count("channels")
    r = client.post("/api/jobs/snapshot", headers=CRON)
    assert r.status_code == 200
    assert r.json() == {"channels": 2, "snapshots": 2, "units_used": 1}
    assert yt.count("channels") == before + 1        # fresh=True skipped the cache, one batched call
    # running twice on the same day updates rows instead of duplicating them
    client.post("/api/jobs/snapshot", headers=CRON)
    assert db.query(ChannelSnapshot).count() == 2


def test_history_grows_over_days(client, db):
    db.add_all([ChannelSnapshot(channel_id=ALPHA, day=date(2026, 10, 1), subscribers=1_100_000,
                                views=290_000_000, videos=480)])
    client.get(f"/api/channels/{ALPHA}")   # creates the channel row and today's snapshot
    db.commit()
    g = client.get(f"/api/channels/{ALPHA}").json()["growth"]
    assert g["days_tracked"] == 2 and g["d30"]["subscribers"] == 100_000
