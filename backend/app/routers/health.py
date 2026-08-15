"""GET /health - liveness plus model-loading state."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import __version__
from app.database import get_db
from app.inference import get_pipeline
from app.models import Job, JobStatus
from app.schemas import HealthResponse, PipelineInfo

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    pipeline = get_pipeline()
    info = pipeline.describe()

    in_flight = (
        db.scalar(
            select(func.count())
            .select_from(Job)
            .where(Job.status.in_([JobStatus.QUEUED, JobStatus.PROCESSING]))
        )
        or 0
    )

    loaded = bool(info.get("loaded"))
    return HealthResponse(
        status="ok" if loaded else "degraded",
        models_loaded=loaded,
        pipeline=PipelineInfo(
            name=str(info["name"]),
            version=str(info["version"]),
            loaded=loaded,
            branches=list(info["branches"]),  # type: ignore[arg-type]
            note=str(info["note"]) if info.get("note") else None,
        ),
        jobs_in_flight=in_flight,
        version=__version__,
    )
