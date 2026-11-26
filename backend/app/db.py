import os

from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

from .config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    # Render/Heroku hand out postgres:// URLs; SQLAlchemy wants an explicit driver.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            url = "postgresql+psycopg://" + url[len(prefix):]
    kwargs = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if ":memory:" in url:
            kwargs["poolclass"] = StaticPool
    elif os.environ.get("VERCEL"):
        # Serverless instances come and go; let Neon's pooler hold connections instead of each instance.
        kwargs["poolclass"] = NullPool
    engine = create_engine(url, pool_pre_ping=True, **kwargs)
    if url.startswith("sqlite"):
        # SQLite ignores foreign keys unless asked; enforce them so local runs behave like Postgres.
        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    return engine


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


_ready = False


def ensure_ready() -> None:
    """Create tables (and demo data) on first use. Runs once per process, so it works without a startup hook."""
    global _ready
    if _ready:
        return
    from . import models  # noqa: F401  (registers the tables)
    try:
        Base.metadata.create_all(engine)
    except (ProgrammingError, IntegrityError):
        Base.metadata.create_all(engine)  # another instance was creating them at the same moment
    if get_settings().demo:
        from .demo import seed_history
        with SessionLocal() as db:
            try:
                seed_history(db)
            except IntegrityError:
                db.rollback()  # seeded concurrently by another instance
    _ready = True


def get_db():
    ensure_ready()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
