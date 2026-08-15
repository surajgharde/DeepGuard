"""Pipeline selection. The rest of the app depends only on `get_pipeline()`."""

from __future__ import annotations

from functools import lru_cache

from app.config import settings
from app.inference.base import (
    STAGES,
    InferencePipeline,
    ModalityResult,
    ProgressCallback,
    ResultDict,
)
from app.inference.mock import MockPipeline

__all__ = [
    "STAGES",
    "InferencePipeline",
    "ModalityResult",
    "ProgressCallback",
    "ResultDict",
    "get_pipeline",
]


@lru_cache
def get_pipeline() -> InferencePipeline:
    """Build (once) the pipeline named by DEEPGUARD_PIPELINE."""
    if settings.pipeline.lower() == "real":
        from app.inference.real import RealPipeline  # imported lazily: heavy deps

        return RealPipeline()
    return MockPipeline()
