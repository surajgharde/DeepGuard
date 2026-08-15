"""The contract every inference backend must satisfy.

The API layer only ever talks to :class:`InferencePipeline`. Swapping the mock
for real PyTorch models means adding one subclass -- no route changes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Literal, Protocol, TypedDict

Verdict = Literal["real", "fake"]

# Canonical stage names and the progress band each one owns.
STAGES: tuple[tuple[str, str, float, float], ...] = (
    ("extracting_frames", "Extracting frames", 0.0, 20.0),
    ("visual_analysis", "Visual analysis", 20.0, 45.0),
    ("audio_analysis", "Audio analysis", 45.0, 65.0),
    ("lipsync_analysis", "Lip-sync analysis", 65.0, 85.0),
    ("fusion", "Fusion", 85.0, 100.0),
)


class ProgressCallback(Protocol):
    """Called by a pipeline to report progress.

    Args:
        stage: machine-readable stage key (see :data:`STAGES`).
        percent: overall completion, 0-100.
        message: human-readable label for the UI.
    """

    def __call__(self, stage: str, percent: float, message: str) -> None: ...


class ModalityResult(TypedDict):
    """Per-branch output. ``score`` is P(manipulated) in [0, 1]."""

    score: float
    label: str
    explanation: str


class ResultDict(TypedDict):
    """What a pipeline returns for a completed analysis."""

    verdict: Verdict
    confidence: float  # confidence in `verdict`, 0-1
    modalities: dict[str, ModalityResult]  # keys: visual, audio, lipsync
    gradcam_frames: list[str]  # paths relative to the outputs directory
    thumbnail: str | None  # path relative to the outputs directory
    frames_analyzed: int
    duration_seconds: float
    model_version: str
    processing_time_ms: int
    notes: str


class InferencePipeline(ABC):
    """Abstract multimodal deepfake detector."""

    name: str = "abstract"
    version: str = "0.0.0"

    @abstractmethod
    def analyze(
        self,
        video_path: Path,
        progress_callback: ProgressCallback,
        output_dir: Path,
    ) -> ResultDict:
        """Run the full multimodal analysis.

        Args:
            video_path: absolute path to the uploaded video.
            progress_callback: invoked repeatedly with stage/percent updates.
            output_dir: job-scoped directory for artefacts (Grad-CAM, thumbnail).

        Returns:
            A :class:`ResultDict`.
        """

    @property
    def is_loaded(self) -> bool:
        """Whether model weights are resident and the pipeline can serve."""
        return True

    def describe(self) -> dict[str, object]:
        return {
            "name": self.name,
            "version": self.version,
            "loaded": self.is_loaded,
            "branches": ["visual", "audio", "lipsync", "fusion"],
        }
