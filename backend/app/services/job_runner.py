"""Background execution of an analysis job.

Runs as a FastAPI BackgroundTask (i.e. in the threadpool), so it owns its own
DB session and writes progress straight to the jobs table -- which is what
GET /api/jobs/{id} polls.
"""

from __future__ import annotations

import logging
import traceback

from app.config import settings
from app.database import SessionLocal
from app.inference import get_pipeline
from app.models import Job, JobStatus, utcnow
from app.services.storage import job_output_dir

logger = logging.getLogger(__name__)

# Progress writes are throttled: only persist when the bar moves this much.
_PROGRESS_EPSILON = 0.9


def run_analysis_job(job_id: str) -> None:
    """Execute the pipeline for ``job_id`` and record the outcome."""
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job is None:
            logger.warning("run_analysis_job: job %s disappeared before start", job_id)
            return
        if not job.stored_filename:
            _fail(db, job, "Upload is missing from disk.")
            return

        video_path = settings.uploads_path / job.stored_filename
        output_dir = job_output_dir(job_id)

        job.status = JobStatus.PROCESSING
        job.stage = "extracting_frames"
        job.progress = 0.0
        db.commit()

        last_written = -100.0

        def progress_callback(stage: str, percent: float, message: str) -> None:
            nonlocal last_written
            percent = max(0.0, min(100.0, percent))
            if percent - last_written < _PROGRESS_EPSILON and percent < 100.0:
                return
            last_written = percent
            job.stage = stage
            job.progress = round(percent, 2)
            job.updated_at = utcnow()
            _ = message  # the UI derives its label from `stage`
            db.commit()

        pipeline = get_pipeline()
        result = pipeline.analyze(video_path, progress_callback, output_dir)

        modalities = result["modalities"]
        job.set_result(dict(result))
        job.verdict = result["verdict"]
        job.confidence = result["confidence"]
        job.visual_score = modalities["visual"]["score"]
        job.audio_score = modalities["audio"]["score"]
        job.lipsync_score = modalities["lipsync"]["score"]
        job.thumbnail_rel = f"{job_id}/{result['thumbnail']}" if result.get("thumbnail") else None
        job.status = JobStatus.DONE
        job.stage = "complete"
        job.progress = 100.0
        job.error = None
        job.completed_at = utcnow()
        db.commit()
        logger.info("job %s finished: %s (%.2f)", job_id, job.verdict, job.confidence or 0.0)

    except Exception as exc:  # noqa: BLE001 - a failed job must never kill the worker
        logger.error("job %s failed: %s\n%s", job_id, exc, traceback.format_exc())
        db.rollback()
        job = db.get(Job, job_id)
        if job is not None:
            _fail(db, job, str(exc) or exc.__class__.__name__)
    finally:
        db.close()


def _fail(db, job: Job, message: str) -> None:  # type: ignore[no-untyped-def]
    job.status = JobStatus.FAILED
    job.stage = "failed"
    job.error = message
    job.completed_at = utcnow()
    db.commit()
