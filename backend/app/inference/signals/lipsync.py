"""Lip-sync agreement between real mouth motion and the real speech envelope.

For each sampled window the mouth region is cropped from a single fixed box, so
frame-to-frame differences measure mouth movement rather than box jitter. That
motion series is cross-correlated against the audio energy envelope resampled
onto the same frame times.

Two things come out of it:

``correlation``  How well mouth movement tracks speech energy at the best
                 alignment. Genuine footage correlates positively; a face
                 driven by different audio does not.
``offset``       The lag at which that best alignment occurs. A large offset is
                 desync even when the shapes do match.

Thresholds are hand-set, and the measurement needs both a visible face and
audible speech -- otherwise the branch reports itself unavailable rather than
inventing a number.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.inference.signals.audio import AudioAnalysis
from app.inference.signals.scan import FrameSample, VideoScan
from app.inference.signals.scoring import combine, describe_level, ramp, robust_mean

MAX_LAG_S = 0.40  # search window for the best alignment
_MIN_PAIRS = 12  # a window needs at least this many frame-to-frame diffs

_ANCHORS: dict[str, tuple[float, float]] = {
    "correlation": (0.45, 0.02),  # peak correlation coefficient
    "offset": (0.06, 0.30),  # |best lag| in seconds
}

_WEIGHTS: dict[str, float] = {"correlation": 0.65, "offset": 0.35}

_LADDER: tuple[tuple[float, str, str], ...] = (
    (0.25, "In sync", "Mouth movement tracks the speech envelope closely and with negligible offset."),
    (0.50, "Mostly aligned", "Small drift at a few boundaries, consistent with ordinary encoding latency."),
    (0.75, "Drifting", "Mouth movement and speech energy align only weakly, at a noticeable offset."),
    (1.01, "High mismatch", "Mouth movement does not track the speech envelope at any plausible offset."),
)


@dataclass(slots=True)
class LipsyncAnalysis:
    available: bool
    score: float
    label: str
    explanation: str
    features: dict[str, float] = field(default_factory=dict)
    raw: dict[str, float] = field(default_factory=dict)
    windows_used: int = 0


def _unavailable(reason: str) -> LipsyncAnalysis:
    return LipsyncAnalysis(
        available=False,
        score=0.5,
        label="Not assessable",
        explanation=f"{reason} This branch did not contribute to the verdict.",
    )


def _median_box(window: list[FrameSample]) -> tuple[int, int, int, int] | None:
    boxes = [frame.face_box for frame in window if frame.face_box is not None]
    if len(boxes) < _MIN_PAIRS:
        return None
    array = np.asarray(boxes, dtype=np.float64)
    return tuple(int(v) for v in np.median(array, axis=0))  # type: ignore[return-value]


def _mouth_motion(window: list[FrameSample], box: tuple[int, int, int, int]) -> tuple[np.ndarray, np.ndarray]:
    """(times, motion) for the mouth region under one fixed box."""
    x, y, w, h = box
    my, mh = y + int(h * 0.60), int(h * 0.34)
    mx, mw = x + int(w * 0.20), int(w * 0.60)

    times: list[float] = []
    crops: list[np.ndarray] = []
    for frame in window:
        gray = frame.gray
        top, bottom = max(0, my), min(gray.shape[0], my + mh)
        left, right = max(0, mx), min(gray.shape[1], mx + mw)
        crop = gray[top:bottom, left:right]
        if crop.size == 0:
            continue
        crops.append(crop.astype(np.float64))
        times.append(frame.time_s)

    if len(crops) < _MIN_PAIRS + 1:
        return np.empty(0), np.empty(0)

    shape = crops[0].shape
    motion = [
        float(np.abs(after - before).mean())
        for before, after in zip(crops, crops[1:])
        if after.shape == shape and before.shape == shape
    ]
    return np.asarray(times[1 : len(motion) + 1]), np.asarray(motion)


def _speech_at(audio: AudioAnalysis, times: np.ndarray) -> np.ndarray:
    """Audio energy envelope resampled onto video frame times."""
    envelope = audio.envelope
    if envelope is None or envelope.size == 0:
        return np.empty(0)
    envelope_times = np.arange(envelope.size) * audio.envelope_hop_s
    return np.interp(times, envelope_times, envelope, left=envelope[0], right=envelope[-1])


def _zscore(values: np.ndarray) -> np.ndarray | None:
    spread = float(values.std())
    if spread < 1e-9:
        return None
    return (values - values.mean()) / spread


def _best_alignment(
    motion: np.ndarray, speech: np.ndarray, fps: float
) -> tuple[float, float] | None:
    """(peak correlation, lag in seconds) over the allowed lag range."""
    a, b = _zscore(motion), _zscore(speech)
    if a is None or b is None:
        return None

    max_lag = int(round(MAX_LAG_S * fps))
    max_lag = min(max_lag, a.size // 3)
    if max_lag < 1:
        return None

    best_corr, best_lag = -2.0, 0
    for lag in range(-max_lag, max_lag + 1):
        if lag < 0:
            left, right = a[-lag:], b[: a.size + lag]
        elif lag > 0:
            left, right = a[: a.size - lag], b[lag:]
        else:
            left, right = a, b
        if left.size < _MIN_PAIRS:
            continue
        corr = float(np.dot(left, right) / left.size)
        if corr > best_corr:
            best_corr, best_lag = corr, lag

    if best_corr < -1.5:
        return None
    return best_corr, best_lag / fps


def analyse_lipsync(scan: VideoScan, audio: AudioAnalysis) -> LipsyncAnalysis:
    """Score audio-visual desync from real mouth motion and real speech energy."""
    if not audio.available or audio.envelope is None or audio.envelope.size == 0:
        return _unavailable("There is no usable audio track to align mouth movement against.")
    if not scan.face_frames:
        return _unavailable("No face could be located in the sampled frames.")

    fps = scan.fps or 25.0
    correlations: list[float] = []
    offsets: list[float] = []

    for window in scan.windows:
        box = _median_box(window)
        if box is None:
            continue
        times, motion = _mouth_motion(window, box)
        if motion.size < _MIN_PAIRS:
            continue
        speech = _speech_at(audio, times)
        if speech.size != motion.size:
            continue
        # A window with no speech in it says nothing about sync.
        if float(speech.max() - speech.min()) < 1e-6 or float(speech.mean()) < 1e-4:
            continue
        alignment = _best_alignment(motion, speech, fps)
        if alignment is None:
            continue
        correlation, offset = alignment
        correlations.append(correlation)
        offsets.append(abs(offset))

    if not correlations:
        return _unavailable(
            "No sampled window contained both a visible face and audible speech."
        )

    raw = {
        "correlation": robust_mean(correlations),
        "offset": robust_mean(offsets),
    }
    features = {
        key: ramp(value, *_ANCHORS[key]) for key, value in raw.items() if np.isfinite(value)
    }
    if not features:
        return _unavailable("Mouth motion and speech energy could not be aligned.")

    score = float(min(0.99, max(0.01, combine(features, _WEIGHTS))))
    label, explanation = describe_level(score, _LADDER)

    return LipsyncAnalysis(
        available=True,
        score=score,
        label=label,
        explanation=explanation,
        features=features,
        raw=raw,
        windows_used=len(correlations),
    )
