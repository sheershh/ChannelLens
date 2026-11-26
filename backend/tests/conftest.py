import os

# CI also runs the suite against Postgres by setting DATABASE_URL.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.update(YOUTUBE_API_KEY="test-key",
                  JWT_SECRET="test-secret-that-is-at-least-32-bytes-long", CRON_SECRET="cron-secret", DAILY_QUOTA="10000")

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import deps  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.youtube import YouTubeClient  # noqa: E402
from tests.fake_youtube import FakeYouTube  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def yt():
    return FakeYouTube()


@pytest.fixture
def http(yt):
    return httpx.Client(transport=httpx.MockTransport(yt.handler))


@pytest.fixture
def client(http):
    app.dependency_overrides[deps.get_http] = lambda: http
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db():
    s = SessionLocal()
    yield s
    s.close()


@pytest.fixture
def ytclient(db, http):
    return YouTubeClient(db, "test-key", http, cache_ttl=3600, daily_quota=10_000)


def signup(client, email="sheersh@example.com", password="correct-horse"):
    r = client.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}
