"""ORM models for jobs and their stored results."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class JobStatus:
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Job(Base):
    """One uploaded video and the analysis run over it.

    The full pipeline output is kept verbatim in ``result_json``; the columns
    around it are denormalised copies used for cheap history listing/sorting.
    """

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)

    status: Mapped[str] = mapped_column(String(20), default=JobStatus.QUEUED, index=True)
    stage: Mapped[str] = mapped_column(String(64), default="queued")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    verdict: Mapped[str | None] = mapped_column(String(10), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    visual_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    audio_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    lipsync_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Path relative to the outputs directory, e.g. "<job_id>/thumb.jpg"
    thumbnail_rel: Mapped[str | None] = mapped_column(String(255), nullable=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def result(self) -> dict[str, Any] | None:
        if not self.result_json:
            return None
        try:
            return json.loads(self.result_json)
        except json.JSONDecodeError:
            return None

    def set_result(self, payload: dict[str, Any]) -> None:
        self.result_json = json.dumps(payload)
