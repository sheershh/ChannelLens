from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import ensure_ready
from .deps import get_youtube
from .routers import auth, channels, jobs, watchlist
from .youtube import YouTubeClient, YouTubeError


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_ready()
    yield


settings = get_settings()
app = FastAPI(title="ChannelLens API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(YouTubeError)
async def youtube_error(_: Request, exc: YouTubeError):
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


@app.get("/api/health", tags=["meta"])
def health(yt: YouTubeClient = Depends(get_youtube)):
    return {"status": "ok", "demo": get_settings().demo,
            "quota_used_today": yt.units_used_today(), "quota_limit": yt.daily_quota}


for r in (auth.router, channels.router, watchlist.router, jobs.router):
    app.include_router(r, prefix="/api")
