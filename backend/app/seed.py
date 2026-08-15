"""Seed the DB with demo history so the app looks alive on first run.

Idempotent: does nothing if the jobs table already has rows. Seeded jobs have
no source video (only generated artefacts), which the UI handles by hiding the
player on the result page.
"""

from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.database import SessionLocal
from app.inference.mock import _describe  # noqa: PLC2701 - shared scoring vocabulary
from app.models import Job, JobStatus
from app.services.media import render_gradcam_frames, render_thumbnail
from app.services.storage import job_output_dir

logger = logging.getLogger(__name__)

# (filename, is_fake, age in hours, duration seconds)
_DEMO_JOBS: tuple[tuple[str, bool, int, float], ...] = (
    ("interview_bbc_clip.mp4", False, 3, 18.4),
    ("celebrity_statement_v2.mp4", True, 27, 12.1),
    ("zoom_call_recording.mov", False, 52, 24.8),
    ("political_address_reenc.mp4", True, 96, 9.6),
    ("podcast_segment_02.avi", True, 150, 31.2),
)


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        existing = db.scalar(select(func.count()).select_from(Job)) or 0
        if existing:
            return

        rng = random.Random(20240517)
        now = datetime.now(timezone.utc)

        for filename, is_fake, age_hours, duration in _DEMO_JOBS:
            job_id = str(uuid.uuid4())
            output_dir = job_output_dir(job_id)
            created = now - timedelta(hours=age_hours, minutes=rng.randint(0, 59))

            scores = _seed_scores(is_fake, rng)
            fused = 0.45 * scores["visual"] + 0.28 * scores["audio"] + 0.27 * scores["lipsync"]
            verdict = "fake" if fused >= 0.5 else "real"
            confidence = fused if verdict == "fake" else 1.0 - fused

            thumb = render_thumbnail(output_dir, seed=rng.randint(0, 10**6))
            frames = render_gradcam_frames(
                output_dir,
                count=rng.randint(5, 6),
                intensity=scores["visual"],
                seed=rng.randint(0, 10**6),
            )

            job = Job(
                id=job_id,
                filename=filename,
                stored_filename=None,
                content_type="video/mp4",
                size_bytes=rng.randint(4, 60) * 1024 * 1024,
                status=JobStatus.DONE,
                stage="complete",
                progress=100.0,
                verdict=verdict,
                confidence=round(confidence, 4),
                visual_score=round(scores["visual"], 4),
                audio_score=round(scores["audio"], 4),
                lipsync_score=round(scores["lipsync"], 4),
                thumbnail_rel=f"{job_id}/{thumb}",
                created_at=created,
                updated_at=created,
                completed_at=created + timedelta(seconds=rng.randint(12, 40)),
            )
            job.set_result(
                {
                    "verdict": verdict,
                    "confidence": round(confidence, 4),
                    "modalities": {key: _describe(key, value) for key, value in scores.items()},
                    "gradcam_frames": frames,
                    "thumbnail": thumb,
                    "frames_analyzed": int(duration * 25 / 3),
                    "duration_seconds": duration,
                    "model_version": "mock-0.1.0",
                    "processing_time_ms": rng.randint(11_000, 18_000),
                    "notes": "Seeded demo record. Synthetic scores, not experimental results.",
                }
            )
            db.add(job)

        # One failure, so the error state is visible in history too.
        failed_at = now - timedelta(hours=71)
        db.add(
            Job(
                id=str(uuid.uuid4()),
                filename="corrupted_upload.mp4",
                stored_filename=None,
                content_type="video/mp4",
                size_bytes=2 * 1024 * 1024,
                status=JobStatus.FAILED,
                stage="failed",
                progress=14.0,
                error="Could not decode video stream (no readable frames).",
                created_at=failed_at,
                updated_at=failed_at,
                completed_at=failed_at + timedelta(seconds=6),
            )
        )

        db.commit()
        logger.info("seeded %d demo jobs", len(_DEMO_JOBS) + 1)
    finally:
        db.close()


def _seed_scores(is_fake: bool, rng: random.Random) -> dict[str, float]:
    base = rng.uniform(0.66, 0.93) if is_fake else rng.uniform(0.05, 0.3)
    return {
        branch: min(0.98, max(0.02, rng.gauss(base, 0.13)))
        for branch in ("visual", "audio", "lipsync")
    }
