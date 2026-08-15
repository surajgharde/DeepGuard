"""Pydantic models for every API response (and the builders that fill them)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.config import settings
from app.models import Job

JobStatusLiteral = Literal["queued", "processing", "done", "failed"]
VerdictLiteral = Literal["real", "fake"]


class ModalityScore(BaseModel):
    score: float = Field(ge=0.0, le=1.0, description="P(manipulated) for this branch")
    label: str
    explanation: str


class AnalysisResult(BaseModel):
    verdict: VerdictLiteral
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence in `verdict`")
    modalities: dict[str, ModalityScore] = Field(description="Keys: visual, audio, lipsync")
    gradcam_frames: list[str] = Field(default_factory=list, description="Absolute image URLs")
    thumbnail_url: str | None = None
    frames_analyzed: int = 0
    duration_seconds: float = 0.0
    model_version: str = "unknown"
    processing_time_ms: int = 0
    notes: str = ""


class JobCreated(BaseModel):
    job_id: str
    filename: str
    size_bytes: int
    status: JobStatusLiteral


class JobStatusResponse(BaseModel):
    job_id: str
    filename: str
    status: JobStatusLiteral
    stage: str
    progress: float = Field(ge=0.0, le=100.0)
    error: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    size_bytes: int = 0
    video_url: str | None = None
    thumbnail_url: str | None = None
    result: AnalysisResult | None = None


class HistoryItem(BaseModel):
    job_id: str
    filename: str
    status: JobStatusLiteral
    created_at: datetime
    verdict: VerdictLiteral | None = None
    confidence: float | None = None
    visual_score: float | None = None
    audio_score: float | None = None
    lipsync_score: float | None = None
    thumbnail_url: str | None = None
    size_bytes: int = 0


class HistoryPage(BaseModel):
    items: list[HistoryItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class PipelineInfo(BaseModel):
    name: str
    version: str
    loaded: bool
    branches: list[str]
    note: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    models_loaded: bool
    pipeline: PipelineInfo
    jobs_in_flight: int
    version: str


class DeleteResponse(BaseModel):
    job_id: str
    deleted: bool


class ErrorResponse(BaseModel):
    detail: str


# --- builders -----------------------------------------------------------------


def _thumbnail_url(job: Job) -> str | None:
    return settings.outputs_url(job.thumbnail_rel) if job.thumbnail_rel else None


def _video_url(job: Job) -> str | None:
    return settings.uploads_url(job.stored_filename) if job.stored_filename else None


def build_result(job: Job) -> AnalysisResult | None:
    """Turn the stored ResultDict into an API result with absolute URLs."""
    raw = job.result
    if not raw:
        return None

    frames = [settings.outputs_url(f"{job.id}/{name}") for name in raw.get("gradcam_frames", [])]
    thumbnail = raw.get("thumbnail")

    return AnalysisResult(
        verdict=raw["verdict"],
        confidence=raw["confidence"],
        modalities={key: ModalityScore(**value) for key, value in raw["modalities"].items()},
        gradcam_frames=frames,
        thumbnail_url=settings.outputs_url(f"{job.id}/{thumbnail}") if thumbnail else None,
        frames_analyzed=raw.get("frames_analyzed", 0),
        duration_seconds=raw.get("duration_seconds", 0.0),
        model_version=raw.get("model_version", "unknown"),
        processing_time_ms=raw.get("processing_time_ms", 0),
        notes=raw.get("notes", ""),
    )


def build_job_status(job: Job) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=job.id,
        filename=job.filename,
        status=job.status,  # type: ignore[arg-type]
        stage=job.stage,
        progress=job.progress,
        error=job.error,
        created_at=job.created_at,
        completed_at=job.completed_at,
        size_bytes=job.size_bytes,
        video_url=_video_url(job),
        thumbnail_url=_thumbnail_url(job),
        result=build_result(job),
    )


def build_history_item(job: Job) -> HistoryItem:
    return HistoryItem(
        job_id=job.id,
        filename=job.filename,
        status=job.status,  # type: ignore[arg-type]
        created_at=job.created_at,
        verdict=job.verdict,  # type: ignore[arg-type]
        confidence=job.confidence,
        visual_score=job.visual_score,
        audio_score=job.audio_score,
        lipsync_score=job.lipsync_score,
        thumbnail_url=_thumbnail_url(job),
        size_bytes=job.size_bytes,
    )
