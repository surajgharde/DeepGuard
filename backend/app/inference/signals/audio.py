"""Audio synthesis features, measured on the real soundtrack.

The track is decoded out of the container with the ffmpeg binary that ships
with ``imageio-ffmpeg`` (no system install required), then four fingerprints of
synthetic speech are measured on it:

``bandwidth``  Vocoders and TTS front-ends usually stop dead at a fixed
               frequency. A sharp cliff in the long-term average spectrum is a
               strong synthesis/resampling tell; genuine recordings roll off.
``silence``    Real rooms are never silent -- there is always floor noise and
               breath. Generated speech often has pathologically clean gaps.
``periodicity`` Vocoder excitation is more regular than a human glottis, so the
               autocorrelation peak over voiced frames is unusually stable.
``dynamics``   Synthetic delivery is flatter: less variation in frame energy
               across the utterance.

As with the visual branch, the thresholds are hand-set rather than learned.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.inference.signals.scoring import combine, describe_level, ramp

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16_000
MAX_SECONDS = 90  # cap the decode so a long upload cannot stall the worker
_FRAME = 400  # 25 ms analysis window
_HOP = 160  # 10 ms hop

# Clean anchors measured on genuine recordings; suspicious anchors reasoned
# from the artefact rather than fitted to labelled synthetic speech.
_ANCHORS: dict[str, tuple[float, float]] = {
    "bandwidth": (0.15, 0.85),  # sharpness of the spectral cliff, 0-1
    "silence": (-22.0, -55.0),  # noise floor vs speech peak, dB
    "periodicity": (0.16, 0.03),  # spread of the autocorrelation peak height
    "dynamics": (0.40, 0.10),  # std of log frame energy over voiced frames
}

_WEIGHTS: dict[str, float] = {
    "bandwidth": 0.34,
    "silence": 0.24,
    "periodicity": 0.24,
    "dynamics": 0.18,
}

_LADDER: tuple[tuple[float, str, str], ...] = (
    (0.25, "Natural", "Bandwidth, noise floor and periodicity match natural recorded speech."),
    (0.50, "Likely natural", "Slightly flat delivery, but no synthesis fingerprints stand out."),
    (0.75, "Questionable", "Unusually regular periodicity and a clean noise floor for a real recording."),
    (1.01, "Synthetic markers", "Hard bandwidth cliff and vocoder-like regularity in the waveform."),
)


class NoAudioTrackError(RuntimeError):
    """The soundtrack could not be decoded, for any reason."""


@lru_cache(maxsize=1)
def resolve_ffmpeg() -> str | None:
    """Path to a usable ffmpeg, or ``None`` if there is none on this machine.

    Prefers the binary bundled with ``imageio-ffmpeg`` so no system install is
    required, and falls back to one on PATH. Returning ``None`` rather than
    raising keeps a missing decoder a *degraded audio branch* instead of a
    failed analysis -- the visual branch does not need ffmpeg at all.
    """
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:  # noqa: BLE001 - missing module, or no binary for this platform
        logger.warning(
            "imageio-ffmpeg unavailable (%s); falling back to ffmpeg on PATH. "
            "Install it with: pip install -r backend/requirements.txt",
            exc,
        )

    return shutil.which("ffmpeg")


@dataclass(slots=True)
class AudioAnalysis:
    available: bool
    score: float
    label: str
    explanation: str
    features: dict[str, float] = field(default_factory=dict)
    raw: dict[str, float] = field(default_factory=dict)
    samples: np.ndarray | None = None
    sample_rate: int = SAMPLE_RATE
    envelope: np.ndarray | None = None  # frame energy at _HOP spacing
    envelope_hop_s: float = _HOP / SAMPLE_RATE


def extract_audio(path: Path, ffmpeg_exe: str | None = None) -> np.ndarray:
    """Decode the soundtrack to mono float32 at :data:`SAMPLE_RATE`.

    Raises:
        NoAudioTrackError: no ffmpeg available, no audio stream, or ffmpeg
            produced nothing.
    """
    if ffmpeg_exe is None:
        ffmpeg_exe = resolve_ffmpeg()
    if not ffmpeg_exe:
        raise NoAudioTrackError(
            "No ffmpeg binary is available to decode the soundtrack. Install the "
            "backend requirements (pip install -r backend/requirements.txt) or put "
            "ffmpeg on PATH."
        )

    command = [
        ffmpeg_exe,
        "-v", "error",
        "-t", str(MAX_SECONDS),
        "-i", str(path),
        "-vn",
        "-ac", "1",
        "-ar", str(SAMPLE_RATE),
        "-f", "f32le",
        "-",
    ]
    try:
        completed = subprocess.run(  # noqa: S603 - fixed argv, no shell
            command,
            capture_output=True,
            timeout=180,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise NoAudioTrackError(f"Audio decode failed: {exc}") from exc

    if not completed.stdout:
        detail = completed.stderr.decode("utf-8", "replace").strip().splitlines()
        raise NoAudioTrackError(detail[-1] if detail else "No audio stream in the container.")

    samples = np.frombuffer(completed.stdout, dtype=np.float32)
    if samples.size < SAMPLE_RATE // 2:
        raise NoAudioTrackError("Audio stream is too short to analyse.")
    return np.ascontiguousarray(samples, dtype=np.float64)


def _frames(samples: np.ndarray) -> np.ndarray:
    """Overlapping analysis frames as a (n, _FRAME) view."""
    if samples.size < _FRAME:
        return np.empty((0, _FRAME))
    count = 1 + (samples.size - _FRAME) // _HOP
    strides = (samples.strides[0] * _HOP, samples.strides[0])
    return np.lib.stride_tricks.as_strided(samples, shape=(count, _FRAME), strides=strides)


def _bandwidth_cliff(samples: np.ndarray) -> float:
    """How abruptly the long-term average spectrum dies, 0 (gentle) to 1 (cliff)."""
    frames = _frames(samples)
    if frames.shape[0] == 0:
        return float("nan")
    window = np.hanning(_FRAME)
    spectrum = np.abs(np.fft.rfft(frames * window, axis=1)) ** 2
    average = spectrum.mean(axis=0)
    average = average / (average.max() or 1.0)
    power_db = 10.0 * np.log10(average + 1e-12)

    freqs = np.fft.rfftfreq(_FRAME, 1.0 / SAMPLE_RATE)
    # Only look above 3 kHz: the cliff, if there is one, is always up there.
    band = freqs >= 3000
    if band.sum() < 8:
        return float("nan")

    curve = power_db[band]
    # Steepest sustained drop over a ~500 Hz span, expressed per kHz.
    span = max(2, int(500 / (freqs[1] - freqs[0])))
    if curve.size <= span:
        return float("nan")
    drops = curve[:-span] - curve[span:]
    steepest = float(drops.max()) / (span * (freqs[1] - freqs[0]) / 1000.0)
    # 6 dB/kHz is an ordinary roll-off; 40 dB/kHz is a brick wall.
    return float(min(1.0, max(0.0, (steepest - 6.0) / 34.0)))


def _energies(samples: np.ndarray) -> np.ndarray:
    frames = _frames(samples)
    if frames.shape[0] == 0:
        return np.empty(0)
    return np.sqrt((frames**2).mean(axis=1))


def _silence_floor(energies: np.ndarray) -> float:
    """Noise floor relative to speech peaks, in dB.

    Expressed in dB because the interesting range spans orders of magnitude: a
    real room sits around -25 dB below speech, while digitally clean generated
    silence can be -60 dB or lower. A linear ratio squashes that distinction
    into the first two percent of the scale.
    """
    if energies.size < 20:
        return float("nan")
    quiet = float(np.percentile(energies, 10))
    loud = float(np.percentile(energies, 90))
    if loud <= 1e-9:
        return float("nan")
    return float(20.0 * np.log10(max(quiet, 1e-9) / loud))


def _periodicity_spread(samples: np.ndarray, energies: np.ndarray) -> float:
    """Variability of the autocorrelation peak across voiced frames."""
    frames = _frames(samples)
    if frames.shape[0] == 0 or energies.size == 0:
        return float("nan")

    voiced = energies >= np.percentile(energies, 65)
    selected = frames[voiced]
    if selected.shape[0] < 12:
        return float("nan")
    # Cap the work: 200 frames is plenty for a stability estimate.
    if selected.shape[0] > 200:
        selected = selected[:: selected.shape[0] // 200][:200]

    # Pitch periods of interest: 60-400 Hz.
    lo, hi = SAMPLE_RATE // 400, SAMPLE_RATE // 60
    peaks: list[float] = []
    for frame in selected:
        centred = frame - frame.mean()
        norm = float((centred**2).sum())
        if norm <= 1e-12:
            continue
        correlation = np.correlate(centred, centred, mode="full")[_FRAME - 1 :]
        segment = correlation[lo:hi]
        if segment.size == 0:
            continue
        peaks.append(float(segment.max() / norm))

    if len(peaks) < 8:
        return float("nan")
    return float(np.std(peaks))


def _dynamics(energies: np.ndarray) -> float:
    """Spread of log frame energy over the voiced part of the track."""
    if energies.size < 20:
        return float("nan")
    voiced = energies[energies >= np.percentile(energies, 40)]
    if voiced.size < 10:
        return float("nan")
    return float(np.std(np.log(voiced + 1e-9)))


def analyse_audio(path: Path) -> AudioAnalysis:
    """Measure synthesis fingerprints on the real soundtrack of ``path``."""
    if not resolve_ffmpeg():
        # A missing decoder is an environment problem, not a property of the
        # upload. Say which it is, so nobody reads "no audio track" off a file
        # that plainly has one.
        logger.error("no ffmpeg available; skipping the audio branch for %s", path.name)
        return AudioAnalysis(
            available=False,
            score=0.5,
            label="Audio decoder unavailable",
            explanation=(
                "No ffmpeg binary was found on this server, so the soundtrack could not "
                "be decoded and no speech-synthesis features were measured. This is a "
                "setup problem, not a finding about the file: install the backend "
                "requirements or put ffmpeg on PATH. This branch did not contribute to "
                "the verdict."
            ),
        )

    try:
        samples = extract_audio(path)
    except NoAudioTrackError as exc:
        logger.info("no audio track for %s: %s", path.name, exc)
        return AudioAnalysis(
            available=False,
            score=0.5,
            label="No audio track",
            explanation=(
                "The file carries no decodable audio stream, so no speech-synthesis "
                "features could be measured. This branch did not contribute to the verdict."
            ),
        )

    peak = float(np.abs(samples).max())
    if peak < 1e-4:
        return AudioAnalysis(
            available=False,
            score=0.5,
            label="Silent track",
            explanation=(
                "The audio stream is effectively silent, so no speech-synthesis features "
                "could be measured. This branch did not contribute to the verdict."
            ),
            samples=samples,
        )

    samples = samples / peak
    energies = _energies(samples)

    raw = {
        "bandwidth": _bandwidth_cliff(samples),
        "silence": _silence_floor(energies),
        "periodicity": _periodicity_spread(samples, energies),
        "dynamics": _dynamics(energies),
    }
    features = {
        key: ramp(value, *_ANCHORS[key])
        for key, value in raw.items()
        if np.isfinite(value)
    }

    if not features:
        return AudioAnalysis(
            available=False,
            score=0.5,
            label="Not assessable",
            explanation=(
                "The soundtrack was too short or too quiet for any synthesis feature "
                "to be measured. This branch did not contribute to the verdict."
            ),
            samples=samples,
            envelope=energies,
        )

    score = float(min(0.99, max(0.01, combine(features, _WEIGHTS))))
    label, explanation = describe_level(score, _LADDER)

    return AudioAnalysis(
        available=True,
        score=score,
        label=label,
        explanation=explanation,
        features=features,
        raw={key: value for key, value in raw.items() if np.isfinite(value)},
        samples=samples,
        envelope=energies,
    )
