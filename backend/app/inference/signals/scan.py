"""Decode real frames from the uploaded video and locate the face in each one.

This is the only module that drives OpenCV's decoder. Everything downstream
measures pixels that came out of here, so if this returns nothing the analysis
honestly reports that it could not read the file.

Frames are sampled as a few *contiguous windows* rather than isolated stills:
the temporal features (face flicker, lip motion) need consecutive frames, while
spreading the windows across the clip still covers the whole thing.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)

WINDOW_COUNT = 3
WINDOW_LENGTH = 32
MAX_WIDTH = 640  # frames are downscaled to at most this wide before analysis
FACE_SIZE = 160  # face crops are resampled to this square
DETECT_WIDTH = 320  # face detection runs on a smaller copy still
REDETECT_EVERY = 8  # frames between Haar detections; the box is held in between

# A detection smaller than this fraction of the frame width is treated as noise.
_MIN_FACE_FRACTION = 0.07


class VideoUnreadableError(RuntimeError):
    """Raised when the container opens but yields no usable frames."""


@dataclass(slots=True)
class FrameSample:
    """One decoded frame plus the face box that was current for it."""

    index: int
    time_s: float
    bgr: np.ndarray  # downscaled colour frame, uint8 HxWx3
    gray: np.ndarray  # uint8 HxW
    face_box: tuple[int, int, int, int] | None  # x, y, w, h in downscaled coords
    face_detected: bool  # True only when Haar fired on *this* frame

    @property
    def has_face(self) -> bool:
        return self.face_box is not None

    def face_crop(self, size: int = FACE_SIZE) -> np.ndarray | None:
        """Grayscale face crop, resampled to a fixed square, or None."""
        if self.face_box is None:
            return None
        x, y, w, h = self.face_box
        crop = self.gray[y : y + h, x : x + w]
        if crop.size == 0:
            return None
        return cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA)

    def mouth_crop(self, size: int = 64) -> np.ndarray | None:
        """Lower-middle third of the face box -- where the mouth lives."""
        if self.face_box is None:
            return None
        x, y, w, h = self.face_box
        my = y + int(h * 0.60)
        mh = int(h * 0.34)
        mx = x + int(w * 0.20)
        mw = int(w * 0.60)
        crop = self.gray[my : my + mh, mx : mx + mw]
        if crop.size == 0:
            return None
        return cv2.resize(crop, (size, size // 2), interpolation=cv2.INTER_AREA)


@dataclass(slots=True)
class VideoScan:
    """Everything the feature extractors need, read once from the file."""

    windows: list[list[FrameSample]] = field(default_factory=list)
    fps: float = 0.0
    duration_s: float = 0.0
    source_frame_count: int = 0
    width: int = 0
    height: int = 0

    @property
    def frames(self) -> list[FrameSample]:
        return [frame for window in self.windows for frame in window]

    @property
    def frames_analyzed(self) -> int:
        return sum(len(window) for window in self.windows)

    @property
    def face_frames(self) -> list[FrameSample]:
        return [frame for frame in self.frames if frame.has_face]

    @property
    def face_ratio(self) -> float:
        total = self.frames_analyzed
        return len(self.face_frames) / total if total else 0.0


def _detect_face(
    cascades: list[cv2.CascadeClassifier],
    gray: np.ndarray,
) -> tuple[int, int, int, int] | None:
    """Largest face in ``gray``, searched on a downscaled copy for speed."""
    height, width = gray.shape[:2]
    scale = DETECT_WIDTH / width if width > DETECT_WIDTH else 1.0
    small = (
        cv2.resize(gray, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)
        if scale < 1.0
        else gray
    )
    small = cv2.equalizeHist(small)
    min_side = int(small.shape[1] * _MIN_FACE_FRACTION)

    for cascade in cascades:
        found = cascade.detectMultiScale(
            small,
            scaleFactor=1.15,
            minNeighbors=5,
            minSize=(max(24, min_side), max(24, min_side)),
        )
        if len(found) == 0:
            continue
        x, y, w, h = max(found, key=lambda box: int(box[2]) * int(box[3]))
        inv = 1.0 / scale
        box = (int(x * inv), int(y * inv), int(w * inv), int(h * inv))
        # Clamp back inside the frame; the inverse scaling can overshoot by a pixel.
        bx, by, bw, bh = box
        bx, by = max(0, bx), max(0, by)
        bw, bh = min(bw, width - bx), min(bh, height - by)
        if bw <= 8 or bh <= 8:
            continue
        return (bx, by, bw, bh)
    return None


def _window_starts(total: int, count: int, length: int) -> list[int]:
    """Evenly spaced start indices for ``count`` windows of ``length`` frames."""
    if total <= length:
        return [0]
    usable = max(1, total - length)
    if count <= 1:
        return [usable // 2]
    step = usable / (count - 1)
    starts = sorted({int(round(i * step)) for i in range(count)})
    return [min(start, usable) for start in starts]


def scan_video(
    path: Path,
    window_count: int = WINDOW_COUNT,
    window_length: int = WINDOW_LENGTH,
    on_progress: object = None,
) -> VideoScan:
    """Decode sampled frames from ``path`` and detect the face in each.

    Raises:
        VideoUnreadableError: the file could not be opened or yielded no frames.
    """
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        capture.release()
        raise VideoUnreadableError("Could not open the video container.")

    try:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        if not np.isfinite(fps) or fps <= 1.0 or fps > 240.0:
            fps = 25.0  # some containers report nonsense; assume a sane default
        source_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        src_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        src_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        # Frame counts from the header are often wrong; only trust a positive one
        # as a hint for where to place the sampling windows.
        planned = _window_starts(source_count, window_count, window_length) if source_count > 0 else [0]

        cascades = [
            cv2.CascadeClassifier(cv2.data.haarcascades + name)
            for name in ("haarcascade_frontalface_default.xml", "haarcascade_profileface.xml")
        ]
        cascades = [c for c in cascades if not c.empty()]

        scan = VideoScan(fps=fps, source_frame_count=source_count)
        scale: float | None = None

        for order, start in enumerate(planned):
            if start > 0 and not capture.set(cv2.CAP_PROP_POS_FRAMES, float(start)):
                logger.debug("seek to frame %d failed; reading from current position", start)

            window: list[FrameSample] = []
            held_box: tuple[int, int, int, int] | None = None

            for offset in range(window_length):
                ok, frame = capture.read()
                if not ok or frame is None:
                    break

                if scale is None:
                    height, width = frame.shape[:2]
                    scan.width, scan.height = width, height
                    scale = MAX_WIDTH / width if width > MAX_WIDTH else 1.0

                if scale < 1.0:
                    frame = cv2.resize(
                        frame,
                        (int(frame.shape[1] * scale), int(frame.shape[0] * scale)),
                        interpolation=cv2.INTER_AREA,
                    )
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

                detected = False
                if cascades and offset % REDETECT_EVERY == 0:
                    box = _detect_face(cascades, gray)
                    if box is not None:
                        held_box = box
                        detected = True

                index = start + offset
                window.append(
                    FrameSample(
                        index=index,
                        time_s=index / fps,
                        bgr=frame,
                        gray=gray,
                        face_box=held_box,
                        face_detected=detected,
                    )
                )

            if window:
                scan.windows.append(window)
            if callable(on_progress):
                on_progress((order + 1) / len(planned))

        if not scan.frames:
            raise VideoUnreadableError("The video contains no readable frames.")

        last = max(frame.index for frame in scan.frames)
        scan.duration_s = round(
            (source_count / fps) if source_count > 0 else ((last + 1) / fps),
            2,
        )
        if src_width and src_height:
            scan.width, scan.height = src_width, src_height
        return scan
    finally:
        capture.release()
