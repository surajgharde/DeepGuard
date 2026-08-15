"""Mock implementation of the multimodal pipeline.

Produces realistic, internally consistent outputs with an artificial delay so
the whole UI can be exercised before the PyTorch branches exist.
"""

from __future__ import annotations

import random
import time
from pathlib import Path

from app.inference.base import (
    STAGES,
    InferencePipeline,
    ModalityResult,
    ProgressCallback,
    ResultDict,
    Verdict,
)
from app.services.media import render_gradcam_frames, render_thumbnail

# Explanation templates per branch, ordered from "clean" to "heavily manipulated".
_EXPLANATIONS: dict[str, tuple[tuple[float, str, str], ...]] = {
    "visual": (
        (0.25, "Consistent", "No blending seams or texture anomalies across sampled face crops."),
        (0.50, "Mostly consistent", "Minor compression artefacts, within the range of genuine footage."),
        (0.75, "Suspicious", "Irregular skin texture and soft boundaries around the jawline."),
        (1.01, "Strong artefacts", "Clear blending seams and frequency artefacts on the face region."),
    ),
    "audio": (
        (0.25, "Natural", "Prosody and spectral envelope match natural speech statistics."),
        (0.50, "Likely natural", "Slightly flat intonation, but no synthesis fingerprints detected."),
        (0.75, "Questionable", "Unnatural formant transitions suggest partial voice conversion."),
        (1.01, "Synthetic markers", "Vocoder-like periodicity and missing breath noise in the waveform."),
    ),
    "lipsync": (
        (0.25, "In sync", "Lip movement aligns tightly with the speech envelope."),
        (0.50, "Mostly aligned", "Small drift on a few phoneme boundaries, likely encoding latency."),
        (0.75, "Drifting", "Audio-visual offset grows on plosives; alignment confidence is low."),
        (1.01, "High mismatch", "High mismatch between lip movement and speech."),
    ),
}


def _describe(branch: str, score: float) -> ModalityResult:
    for threshold, label, explanation in _EXPLANATIONS[branch]:
        if score < threshold:
            return {"score": round(score, 4), "label": label, "explanation": explanation}
    raise AssertionError("score outside [0, 1]")


class MockPipeline(InferencePipeline):
    """Staged, sleep-driven stand-in for the real detector."""

    name = "mock"
    version = "mock-0.1.0"

    def __init__(self, speed: float = 1.0, seed: int | None = None) -> None:
        # speed < 1 makes runs slower, > 1 faster. Useful for demos.
        self.speed = max(0.05, speed)
        self._rng = random.Random(seed)

    @property
    def is_loaded(self) -> bool:
        return True

    def describe(self) -> dict[str, object]:
        info = super().describe()
        info["note"] = "Mock inference - no model weights loaded"
        return info

    def analyze(
        self,
        video_path: Path,
        progress_callback: ProgressCallback,
        output_dir: Path,
    ) -> ResultDict:
        started = time.perf_counter()
        rng = self._rng

        # Ground truth for this synthetic run; branch scores are drawn to agree
        # with it (with some noise) so the modality cards look coherent.
        is_fake = rng.random() < 0.5
        scores = self._draw_scores(is_fake, rng)

        # Roughly 11-17s end to end at speed 1.0.
        stage_seconds = {
            "extracting_frames": rng.uniform(2.4, 3.6),
            "visual_analysis": rng.uniform(3.0, 4.4),
            "audio_analysis": rng.uniform(2.2, 3.2),
            "lipsync_analysis": rng.uniform(2.4, 3.4),
            "fusion": rng.uniform(1.0, 1.8),
        }

        gradcam_names: list[str] = []
        thumbnail_name: str | None = None

        for key, label, start, end in STAGES:
            self._run_stage(key, label, start, end, stage_seconds[key], progress_callback)

            if key == "extracting_frames":
                thumbnail_name = render_thumbnail(output_dir, seed=rng.randint(0, 10**6))
            elif key == "visual_analysis":
                gradcam_names = render_gradcam_frames(
                    output_dir,
                    count=rng.randint(5, 7),
                    intensity=scores["visual"],
                    seed=rng.randint(0, 10**6),
                )

        fused = 0.45 * scores["visual"] + 0.28 * scores["audio"] + 0.27 * scores["lipsync"]
        fused = min(0.99, max(0.01, fused + rng.uniform(-0.03, 0.03)))
        verdict: Verdict = "fake" if fused >= 0.5 else "real"
        confidence = fused if verdict == "fake" else 1.0 - fused

        progress_callback("fusion", 100.0, "Fusion")

        duration = round(rng.uniform(6.0, 24.0), 1)
        return {
            "verdict": verdict,
            "confidence": round(confidence, 4),
            "modalities": {branch: _describe(branch, value) for branch, value in scores.items()},
            "gradcam_frames": gradcam_names,
            "thumbnail": thumbnail_name,
            "frames_analyzed": int(duration * 25 / 3),
            "duration_seconds": duration,
            "model_version": self.version,
            "processing_time_ms": int((time.perf_counter() - started) * 1000),
            "notes": (
                "Generated by MockPipeline. Scores are synthetic and must not be "
                "cited as experimental results."
            ),
        }

    def _run_stage(
        self,
        key: str,
        label: str,
        start: float,
        end: float,
        seconds: float,
        progress_callback: ProgressCallback,
    ) -> None:
        """Sleep through one stage, ticking progress across its band."""
        ticks = 12
        seconds = seconds / self.speed
        progress_callback(key, start, label)
        for tick in range(1, ticks + 1):
            time.sleep(seconds / ticks)
            progress_callback(key, start + (end - start) * tick / ticks, label)

    @staticmethod
    def _draw_scores(is_fake: bool, rng: random.Random) -> dict[str, float]:
        """Per-branch P(manipulated), correlated with the ground truth.

        One branch is allowed to disagree -- that disagreement is exactly what
        makes the three modality cards interesting to look at.
        """
        if is_fake:
            base = rng.uniform(0.62, 0.94)
            spread = 0.18
        else:
            base = rng.uniform(0.06, 0.36)
            spread = 0.16

        scores = {
            branch: min(0.985, max(0.015, rng.gauss(base, spread)))
            for branch in ("visual", "audio", "lipsync")
        }

        if rng.random() < 0.3:  # one dissenting branch
            odd = rng.choice(list(scores))
            scores[odd] = min(0.985, max(0.015, 1.0 - scores[odd] + rng.uniform(-0.12, 0.12)))

        return scores
