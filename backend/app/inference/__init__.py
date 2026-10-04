"""Pipeline selection. The rest of the app depends only on `get_pipeline()`."""

from __future__ import annotations

import logging
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

logger = logging.getLogger(__name__)


@lru_cache
def get_pipeline() -> InferencePipeline:
    """Build (once) the pipeline named by DEEPGUARD_PIPELINE.

    ``heuristic`` (the default) measures the uploaded file. ``mock`` returns
    randomly generated scores and is only useful for exercising the UI --
    it never looks at the video.
    """
    choice = settings.pipeline.lower()
    if choice == "real":
        from app.inference.real import RealPipeline  # imported lazily: heavy deps

        return RealPipeline()
    if choice == "mock":
        return MockPipeline()
    if choice != "heuristic":
        logger.warning("unknown DEEPGUARD_PIPELINE=%r; falling back to heuristic", choice)

    from app.inference.heuristic import HeuristicPipeline  # lazy: pulls in OpenCV

    return HeuristicPipeline()
