"""Upload validation, streaming save and per-job file cleanup."""

from __future__ import annotations

import logging
import shutil
import time
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1024 * 1024  # 1 MiB

ALLOWED_CONTENT_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/avi",
    "video/msvideo",
    "application/octet-stream",  # browsers sometimes send this for .avi/.mov
}


def validate_upload(file: UploadFile) -> str:
    """Check extension and declared MIME type. Returns the lowercase extension."""
    name = (file.filename or "").strip()
    if not name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file name provided.")

    extension = Path(name).suffix.lower()
    if extension not in settings.allowed_extensions:
        allowed = ", ".join(settings.allowed_extensions)
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported file type '{extension or 'unknown'}'. Allowed: {allowed}.",
        )

    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported content type '{file.content_type}'.",
        )

    return extension


async def save_upload(file: UploadFile, job_id: str, extension: str) -> tuple[str, int]:
    """Stream the upload to disk, aborting past the size limit.

    Returns:
        (stored_filename, size_bytes)
    """
    settings.ensure_dirs()
    stored_filename = f"{job_id}{extension}"
    destination = settings.uploads_path / stored_filename

    size = 0
    try:
        with destination.open("wb") as handle:
            while chunk := await file.read(CHUNK_SIZE):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    handle.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        f"File exceeds the {settings.max_upload_mb} MB limit.",
                    )
                handle.write(chunk)
    except HTTPException:
        raise
    except OSError as exc:  # disk full, permissions, ...
        destination.unlink(missing_ok=True)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, f"Could not store upload: {exc}"
        ) from exc
    finally:
        await file.close()

    if size == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty.")

    return stored_filename, size


def job_output_dir(job_id: str) -> Path:
    path = settings.outputs_path / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def delete_job_files(job_id: str, stored_filename: str | None) -> None:
    """Best-effort removal of the upload and every generated artefact.

    Never raises: on Windows a file that was just streamed by StaticFiles can
    stay locked for a moment, and that must not fail an otherwise successful
    delete. We retry briefly, then leave the orphan behind with a warning.
    """
    if stored_filename:
        _unlink_with_retry(settings.uploads_path / stored_filename)
    shutil.rmtree(settings.outputs_path / job_id, ignore_errors=True)


def _unlink_with_retry(path: Path, attempts: int = 5, delay: float = 0.2) -> None:
    for attempt in range(attempts):
        try:
            path.unlink(missing_ok=True)
            return
        except OSError as exc:
            if attempt == attempts - 1:
                logger.warning("could not delete %s: %s", path, exc)
                return
            time.sleep(delay)
