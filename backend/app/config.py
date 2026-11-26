import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./channellens.db"
    youtube_api_key: str = ""
    jwt_secret: str = ""          # random per process if empty (dev only)
    cron_secret: str = ""         # protects POST /api/jobs/snapshot
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool = bool(os.environ.get("VERCEL"))   # HTTPS-only cookie in production
    # Fictional channels from app/demo.py. Unset = on exactly when there's no YouTube API key.
    demo_mode: bool | None = None

    cache_ttl_seconds: int = 3600
    daily_quota: int = 10_000     # YouTube Data API default
    recent_videos: int = 20
    rpm_low: float = 1.0          # creator revenue per 1,000 views, USD
    rpm_high: float = 4.0

    @property
    def demo(self) -> bool:
        return self.demo_mode if self.demo_mode is not None else not self.youtube_api_key

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
