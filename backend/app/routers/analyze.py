"""POST /api/analyze - accept a video and launch background inference."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Job, JobStatus
from app.schemas import ErrorResponse, JobCreated
from app.services.job_runner import run_analysis_job
from app.services.storage import save_upload, validate_upload

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post(
    "/analyze",
    response_model=JobCreated,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
    },
)
async def analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Video file: mp4, avi or mov, max 100 MB"),
    db: Session = Depends(get_db),
) -> JobCreated:
    extension = validate_upload(file)
    job_id = str(uuid.uuid4())
    stored_filename, size = await save_upload(file, job_id, extension)

    job = Job(
        id=job_id,
        filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        content_type=file.content_type,
        size_bytes=size,
        status=JobStatus.QUEUED,
        stage="queued",
        progress=0.0,
    )
    db.add(job)
    db.commit()

    background_tasks.add_task(run_analysis_job, job_id)

    return JobCreated(
        job_id=job.id,
        filename=job.filename,
        size_bytes=job.size_bytes,
        status=JobStatus.QUEUED,  # type: ignore[arg-type]
    )
