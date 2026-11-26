from tests.conftest import signup


def test_register_login_me(client):
    headers = signup(client)
    assert client.get("/api/auth/me", headers=headers).json()["email"] == "sheersh@example.com"
    r = client.post("/api/auth/login", json={"email": "SHEERSH@example.com", "password": "correct-horse"})
    assert r.status_code == 200 and r.json()["token"]


def test_cookie_session_and_logout(client):
    signup(client)                                   # TestClient keeps the httpOnly cookie
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_duplicate_email(client):
    signup(client)
    client.cookies.clear()
    r = client.post("/api/auth/register", json={"email": "sheersh@example.com", "password": "another-pass"})
    assert r.status_code == 409


def test_wrong_password(client):
    signup(client)
    r = client.post("/api/auth/login", json={"email": "sheersh@example.com", "password": "wrong-pass"})
    assert r.status_code == 401


def test_validation(client):
    assert client.post("/api/auth/register", json={"email": "x@example.com", "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={"email": "not-an-email", "password": "longenough"}).status_code == 422


def test_bad_token(client):
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_password_is_hashed(client, db):
    from app.models import User
    signup(client)
    assert db.query(User).one().password_hash.startswith("$2")
