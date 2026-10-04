"""Signal-analysis pipeline: every number is measured from the uploaded file.

What this is
------------
A deterministic forensic analyser. It decodes real frames, finds the face,
measures classical manipulation signals (detail deficit, spectral smoothing,
blending seams, noise inconsistency, temporal flicker), measures synthesis
fingerprints on the real soundtrack, and cross-correlates real mouth motion
against the real speech envelope. The same file always produces the same
result -- there is no randomness anywhere in the scoring path.

What this is **not**
--------------------
A trained deepfake detector. There is no neural network and no learned
decision boundary: the thresholds in :mod:`app.inference.signals` are hand-set
operating points, chosen to be reasonable rather than fitted to FaceForensics++
or DFDC. So the output is *evidence about the file*, and it is honest about
which evidence it could and could not gather -- but it carries no measured
accuracy figure, and none should be quoted for it. Reporting a benchmark number
would require training and evaluating against a labelled corpus.

Every result carries this caveat in ``notes`` and the UI shows it on the page.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

from app.inference.base import InferencePipeline, ProgressCallback, ResultDict, Verdict
from app.inference.signals import (
    AudioAnalysis,
    LipsyncAnalysis,
    VideoScan,
    VideoUnreadableError,
    VisualAnalysis,
    analyse_audio,
    analyse_lipsync,
    analyse_visual,
    scan_video,
)
from app.services.overlay import (
    pick_poster_frame,
    render_artefact_frames,
    render_thumbnail,
    select_overlay_frames,
)

logger = logging.getLogger(__name__)

# Relative influence of each branch. Renormalised over the branches that could
# actually be measured, so a clip with no audio is scored on vision alone
# rather than being dragged toward 0.5 by two absent modalities.
_FUSION_WEIGHTS = {"visual": 0.50, "audio": 0.25, "lipsync": 0.25}

# Hand-set thresholds cannot support a confident claim. Even a unanimous,
# extreme reading is capped here, and thin evidence pulls it lower still.
_CONFIDENCE_CEILING = 0.85

_OVERLAY_FRAMES = 6

_NOTES = (
    "Heuristic signal analysis, not a trained detector. Scores come from hand-set "
    "forensic thresholds measured directly on this file, so they are reproducible "
    "but carry no validated accuracy figure and must not be cited as experimental "
    "results or used as evidence about a real person."
)


class HeuristicPipeline(InferencePipeline):
    """Deterministic multimodal analysis built on measured signals."""

    name = "heuristic"
    version = "heuristic-1.0.0"

    def __init__(self, window_count: int = 3, window_length: int = 32) -> None:
        self.window_count = window_count
        self.window_length = window_length

    @property
    def is_loaded(self) -> bool:
        # No weights to load: the analysis is always ready to serve.
        return True

    def describe(self) -> dict[str, object]:
        info = super().describe()
        info["note"] = "Signal analysis - hand-set thresholds, no trained model"
        return info

    def analyze(
        self,
        video_path: Path,
        progress_callback: ProgressCallback,
        output_dir: Path,
    ) -> ResultDict:
        started = time.perf_counter()

        # --- extracting_frames (0-20) -----------------------------------------
        progress_callback("extracting_frames", 0.0, "Extracting frames")
        try:
            scan = scan_video(
                video_path,
                window_count=self.window_count,
                window_length=self.window_length,
                on_progress=lambda fraction: progress_callback(
                    "extracting_frames", 2.0 + 16.0 * fraction, "Extracting frames"
                ),
            )
        except VideoUnreadableError as exc:
            raise RuntimeError(str(exc)) from exc

        poster = pick_poster_frame(scan.frames)
        thumbnail_name = render_thumbnail(output_dir, poster) if poster is not None else None
        progress_callback("extracting_frames", 20.0, "Extracting frames")

        # --- visual_analysis (20-45) ------------------------------------------
        progress_callback("visual_analysis", 20.0, "Visual analysis")
        visual = analyse_visual(scan)
        progress_callback("visual_analysis", 36.0, "Visual analysis")

        overlay_frames = select_overlay_frames(scan.frames, _OVERLAY_FRAMES)
        artefact_names = render_artefact_frames(output_dir, overlay_frames, scan.fps)
        progress_callback("visual_analysis", 45.0, "Visual analysis")

        # --- audio_analysis (45-65) -------------------------------------------
        progress_callback("audio_analysis", 45.0, "Audio analysis")
        audio = analyse_audio(video_path)
        progress_callback("audio_analysis", 65.0, "Audio analysis")

        # --- lipsync_analysis (65-85) -----------------------------------------
        progress_callback("lipsync_analysis", 65.0, "Lip-sync analysis")
        lipsync = analyse_lipsync(scan, audio)
        progress_callback("lipsync_analysis", 85.0, "Lip-sync analysis")

        # --- fusion (85-100) ---------------------------------------------------
        progress_callback("fusion", 85.0, "Fusion")
        fused, verdict, confidence = self._fuse(visual, audio, lipsync, scan)

        result: ResultDict = {
            "verdict": verdict,
            "confidence": round(confidence, 4),
            "modalities": {
                "visual": {
                    "score": round(visual.score, 4),
                    "label": visual.label,
                    "explanation": visual.explanation,
                },
                "audio": {
                    "score": round(audio.score, 4),
                    "label": audio.label,
                    "explanation": audio.explanation,
                },
                "lipsync": {
                    "score": round(lipsync.score, 4),
                    "label": lipsync.label,
                    "explanation": lipsync.explanation,
                },
            },
            "gradcam_frames": artefact_names,
            "thumbnail": thumbnail_name,
            "frames_analyzed": scan.frames_analyzed,
            "duration_seconds": scan.duration_s,
            "model_version": self.version,
            "processing_time_ms": int((time.perf_counter() - started) * 1000),
            "notes": self._notes(visual, audio, lipsync, scan, fused),
        }

        progress_callback("fusion", 100.0, "Fusion")
        logger.info(
            "%s: verdict=%s fused=%.3f visual=%.3f audio=%s lipsync=%s faces=%.0f%%",
            video_path.name,
            verdict,
            fused,
            visual.score,
            f"{audio.score:.3f}" if audio.available else "n/a",
            f"{lipsync.score:.3f}" if lipsync.available else "n/a",
            scan.face_ratio * 100,
        )
        return result

    # --- fusion ---------------------------------------------------------------

    def _fuse(
        self,
        visual: VisualAnalysis,
        audio: AudioAnalysis,
        lipsync: LipsyncAnalysis,
        scan: VideoScan,
    ) -> tuple[float, Verdict, float]:
        """Combine the branches that were measurable into a verdict + confidence."""
        available: dict[str, float] = {}
        if visual.reliability != "no-face":
            available["visual"] = visual.score
        if audio.available:
            available["audio"] = audio.score
        if lipsync.available:
            available["lipsync"] = lipsync.score

        if not available:
            # Nothing could be measured. Say so with minimum confidence rather
            # than guessing; the notes explain why.
            return 0.5, "real", 0.5

        total = sum(_FUSION_WEIGHTS[key] for key in available)
        fused = sum(score * _FUSION_WEIGHTS[key] for key, score in available.items()) / total
        fused = float(min(0.99, max(0.01, fused)))

        verdict: Verdict = "fake" if fused >= 0.5 else "real"

        # Confidence starts from distance to the decision boundary, then is
        # discounted for thin evidence and capped, because the boundary itself
        # is a hand-set threshold rather than a validated one.
        margin = abs(fused - 0.5) * 2.0
        confidence = 0.5 + 0.5 * margin

        evidence = total  # 1.0 when all three branches contributed
        if visual.reliability == "sparse-face":
            evidence *= 0.85
        if scan.frames_analyzed < 24:
            evidence *= 0.85

        confidence = 0.5 + (confidence - 0.5) * min(1.0, evidence)
        confidence = min(_CONFIDENCE_CEILING, max(0.5, confidence))
        return fused, verdict, confidence

    # --- notes ----------------------------------------------------------------

    @staticmethod
    def _notes(
        visual: VisualAnalysis,
        audio: AudioAnalysis,
        lipsync: LipsyncAnalysis,
        scan: VideoScan,
        fused: float,
    ) -> str:
        measured = [
            name
            for name, ok in (
                ("visual", visual.reliability != "no-face"),
                ("audio", audio.available),
                ("lip-sync", lipsync.available),
            )
            if ok
        ]
        skipped = [
            name
            for name, ok in (
                ("visual", visual.reliability != "no-face"),
                ("audio", audio.available),
                ("lip-sync", lipsync.available),
            )
            if not ok
        ]

        parts = [_NOTES]
        parts.append(
            f"Measured {scan.frames_analyzed} frames across {len(scan.windows)} sampled "
            f"windows; a face was found in {scan.face_ratio * 100:.0f}% of them."
        )
        if measured:
            parts.append(f"Branches contributing to the verdict: {', '.join(measured)}.")
        if skipped:
            parts.append(
                f"Not assessable on this file: {', '.join(skipped)} "
                "(excluded from fusion rather than defaulted)."
            )
        parts.append(f"Fused manipulation score {fused:.2f} on a 0-1 scale.")
        return " ".join(parts)
