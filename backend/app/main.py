"""DeepGuard FastAPI application."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.config import settings
from app.database import init_db
from app.routers import analyze, health, history, jobs
from app.seed import seed_if_empty

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s: %(message)s",
)
logger = logging.getLogger("deepguard")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings.ensure_dirs()
    init_db()
    if settings.seed_on_startup:
        seed_if_empty()
    logger.info("DeepGuard %s up | pipeline=%s | db=%s", __version__, settings.pipeline, settings.database_url)
    yield


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description=(
        "Multimodal deepfake detection API: visual (EfficientNet-B0), "
        "audio (Wav2Vec2 + MLP) and lip-sync (SyncNet-style) branches with a fusion head."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings.ensure_dirs()
# Generated artefacts (Grad-CAM frames, thumbnails).
app.mount(
    settings.outputs_url_path,
    StaticFiles(directory=settings.outputs_path),
    name="outputs",
)
# Uploaded videos, so the result page can play the source clip.
app.mount(
    settings.uploads_url_path,
    StaticFiles(directory=settings.uploads_path),
    name="uploads",
)

app.include_router(health.router)
app.include_router(analyze.router)
app.include_router(jobs.router)
app.include_router(history.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": __version__,
        "docs": "/docs",
        "health": "/health",
    }
