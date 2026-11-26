import httpx
from fastapi.testclient import TestClient

from app import demo, deps
from app.db import SessionLocal
from app.main import app
from app.models import ChannelSnapshot

ORBIT = demo.channel_id("o")


def test_demo_ids_are_valid_channel_ids():
    from app.youtube import CHANNEL_ID_RE
    assert all(CHANNEL_ID_RE.match(cid) for cid in demo.CHANNELS)


def test_demo_end_to_end():
    with SessionLocal() as db:
        demo.seed_history(db)
        demo.seed_history(db)               # idempotent
        assert db.query(ChannelSnapshot).count() == 3 * 90
    app.dependency_overrides[deps.get_http] = lambda: httpx.Client(transport=httpx.MockTransport(demo.handler))
    try:
        with TestClient(app) as c:
            assert c.get("/api/channels/search", params={"q": "@orbitlab"}).json()["results"][0]["id"] == ORBIT
            body = c.get(f"/api/channels/{ORBIT}").json()
            assert len(body["videos"]) == 20 and body["summary"]["engagement_rate"] > 0
            assert body["growth"]["d30"]["subscribers"] > 0
    finally:
        app.dependency_overrides.clear()
