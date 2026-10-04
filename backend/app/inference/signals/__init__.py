"""Signal-analysis primitives for the heuristic pipeline.

Every function in this package measures the uploaded file. Nothing here is
random, and nothing here is a trained model.
"""

from __future__ import annotations

from app.inference.signals.audio import AudioAnalysis, NoAudioTrackError, analyse_audio
from app.inference.signals.lipsync import LipsyncAnalysis, analyse_lipsync
from app.inference.signals.scan import (
    FrameSample,
    VideoScan,
    VideoUnreadableError,
    scan_video,
)
from app.inference.signals.visual import VisualAnalysis, analyse_visual, artefact_map

__all__ = [
    "AudioAnalysis",
    "FrameSample",
    "LipsyncAnalysis",
    "NoAudioTrackError",
    "VideoScan",
    "VideoUnreadableError",
    "VisualAnalysis",
    "analyse_audio",
    "analyse_lipsync",
    "analyse_visual",
    "artefact_map",
    "scan_video",
]
