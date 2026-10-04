"""Render real video frames with the measured artefact map on top.

This replaces the synthetic Pillow frames in :mod:`app.services.media` for the
heuristic pipeline. Every pixel written here came out of the uploaded file, and
the heat is :func:`app.inference.signals.visual.artefact_map` -- a direct
measurement, not a network gradient. It is deliberately *not* called Grad-CAM.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from app.inference.signals.scan import FrameSample
from app.inference.signals.visual import artefact_map

OUTPUT_WIDTH = 480
THUMB_SIZE = (384, 216)
_HEAT_ALPHA = 0.62  # peak opacity of the overlay where suspicion is highest
_CAPTION_H = 22


def _fit(image: np.ndarray, width: int) -> np.ndarray:
    height = max(1, int(round(image.shape[0] * width / image.shape[1])))
    interp = cv2.INTER_AREA if width < image.shape[1] else cv2.INTER_LINEAR
    return cv2.resize(image, (width, height), interpolation=interp)


def _caption(image: np.ndarray, left: str, right: str = "") -> None:
    """Draw a dark caption bar along the bottom, in place."""
    height, width = image.shape[:2]
    top = height - _CAPTION_H
    cv2.rectangle(image, (0, top), (width, height), (20, 13, 10), -1)
    font, scale, thickness = cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1
    cv2.putText(image, left, (8, height - 7), font, scale, (220, 200, 190), thickness, cv2.LINE_AA)
    if right:
        (text_w, _), _ = cv2.getTextSize(right, font, scale, thickness)
        cv2.putText(
            image, right, (width - text_w - 8, height - 7), font, scale,
            (200, 210, 226), thickness, cv2.LINE_AA,
        )
    cv2.rectangle(image, (0, 0), (width - 1, height - 1), (92, 70, 60), 1)


def _blend(bgr: np.ndarray, heat: np.ndarray) -> np.ndarray:
    """Alpha-composite a jet colourmap of ``heat`` over ``bgr``."""
    heat_u8 = np.clip(heat * 255.0, 0, 255).astype(np.uint8)
    coloured = cv2.applyColorMap(heat_u8, cv2.COLORMAP_JET).astype(np.float64)

    # Opacity follows the measurement: cool areas stay almost untouched, so the
    # underlying frame remains readable and the hot regions are the story.
    alpha = (heat[..., None] ** 1.4) * _HEAT_ALPHA
    blended = bgr.astype(np.float64) * (1.0 - alpha) + coloured * alpha
    return np.clip(blended, 0, 255).astype(np.uint8)


def select_overlay_frames(frames: list[FrameSample], count: int) -> list[FrameSample]:
    """Evenly spaced frames that actually have a face, for the artefact strip."""
    candidates = [frame for frame in frames if frame.has_face] or frames
    if not candidates:
        return []
    if len(candidates) <= count:
        return candidates
    step = len(candidates) / count
    return [candidates[min(len(candidates) - 1, int(i * step))] for i in range(count)]


def render_artefact_frames(
    output_dir: Path,
    frames: list[FrameSample],
    fps: float,
) -> list[str]:
    """Write one JPEG per frame with its measured artefact map overlaid.

    Returns:
        File names relative to ``output_dir``, in time order.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    names: list[str] = []

    for position, frame in enumerate(frames):
        heat = artefact_map(frame)
        image = _fit(_blend(frame.bgr, heat), OUTPUT_WIDTH)
        stamp = f"{frame.time_s:0.2f}s" if fps else ""
        _caption(image, f"frame {frame.index:05d}", stamp)

        name = f"artefact_{position + 1:02d}.jpg"
        cv2.imwrite(str(output_dir / name), image, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
        names.append(name)

    return names


def render_thumbnail(output_dir: Path, frame: FrameSample, name: str = "thumb.jpg") -> str:
    """Write a real poster frame from the video, centre-cropped to 16:9."""
    output_dir.mkdir(parents=True, exist_ok=True)
    target_w, target_h = THUMB_SIZE

    image = frame.bgr
    height, width = image.shape[:2]
    target_ratio = target_w / target_h
    ratio = width / height

    if ratio > target_ratio:  # too wide - crop the sides
        new_w = int(round(height * target_ratio))
        left = (width - new_w) // 2
        image = image[:, left : left + new_w]
    elif ratio < target_ratio:  # too tall - crop top and bottom
        new_h = int(round(width / target_ratio))
        top = (height - new_h) // 2
        image = image[top : top + new_h, :]

    image = cv2.resize(image, (target_w, target_h), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(output_dir / name), image, [int(cv2.IMWRITE_JPEG_QUALITY), 86])
    return name


def pick_poster_frame(frames: list[FrameSample]) -> FrameSample | None:
    """The sharpest frame that contains a face -- a sensible poster still."""
    candidates = [frame for frame in frames if frame.has_face] or frames
    if not candidates:
        return None
    return max(
        candidates,
        key=lambda frame: float(cv2.Laplacian(frame.gray, cv2.CV_64F).var()),
    )
