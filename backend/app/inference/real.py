"""Placeholder for the real PyTorch pipeline.

Fill in the four TODO blocks and set DEEPGUARD_PIPELINE=real. Nothing in the
API layer needs to change: routes, schemas and the frontend already speak
:class:`~app.inference.base.ResultDict`.
"""

from __future__ import annotations

from pathlib import Path

from app.inference.base import STAGES, InferencePipeline, ProgressCallback, ResultDict


class RealPipeline(InferencePipeline):
    """EfficientNet-B0 (visual) + Wav2Vec2/MLP (audio) + SyncNet (lip-sync) + fusion head."""

    name = "real"
    version = "real-0.0.0"

    def __init__(self, weights_dir: Path | None = None, device: str = "cpu") -> None:
        self.weights_dir = weights_dir
        self.device = device
        self._loaded = False
        # TODO(1) load checkpoints here, e.g.:
        #   self.visual = torch.load(weights_dir / "efficientnet_b0.pt", map_location=device)
        #   self.audio = ...
        #   self.lipsync = ...
        #   self.fusion = ...
        #   self._loaded = True

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def analyze(
        self,
        video_path: Path,
        progress_callback: ProgressCallback,
        output_dir: Path,
    ) -> ResultDict:
        _ = (video_path, output_dir)
        for key, label, start, _end in STAGES:
            progress_callback(key, start, label)
            # TODO(2) extracting_frames: decode video, detect + crop faces, save thumbnail.
            # TODO(3) visual/audio/lipsync: run each branch, write Grad-CAM overlays
            #         for the visual branch into `output_dir`.
            # TODO(4) fusion: combine branch logits, map to verdict + confidence,
            #         then return a ResultDict with the same keys MockPipeline returns.
        raise NotImplementedError(
            "RealPipeline is not implemented yet. Run with DEEPGUARD_PIPELINE=mock."
        )
