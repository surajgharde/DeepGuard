"""GET /api/jobs/{job_id} and DELETE /api/jobs/{job_id}."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Job
from app.schemas import DeleteResponse, ErrorResponse, JobStatusResponse, build_job_status
from app.services.storage import delete_job_files

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _get_job_or_404(db: Session, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{job_id}' not found.")
    return job


@router.get(
    "/{job_id}",
    response_model=JobStatusResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobStatusResponse:
    """Status, progress and -- once done -- the full result. Polled every 2s."""
    return build_job_status(_get_job_or_404(db, job_id))


@router.delete(
    "/{job_id}",
    response_model=DeleteResponse,
    responses={404: {"model": ErrorResponse}},
)
def delete_job(job_id: str, db: Session = Depends(get_db)) -> DeleteResponse:
    """Remove the job row plus its upload and generated artefacts."""
    job = _get_job_or_404(db, job_id)
    stored_filename = job.stored_filename

    db.delete(job)
    db.commit()
    delete_job_files(job_id, stored_filename)

    return DeleteResponse(job_id=job_id, deleted=True)
