"""Synthetic frame / heatmap rendering for the mock pipeline.

The real pipeline will replace these with decoded video frames and genuine
Grad-CAM overlays. Everything here is Pillow-only so the mock stack needs no
OpenCV/torch install.
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

FRAME_SIZE = (384, 216)
THUMB_SIZE = (384, 216)


def _base_frame(rng: random.Random, size: tuple[int, int]) -> Image.Image:
    """A plausible-looking blurred "video frame": vignetted noise + a face box."""
    width, height = size

    noise = Image.effect_noise((width // 6, height // 6), 48).resize(size, Image.Resampling.BILINEAR)
    noise = noise.filter(ImageFilter.GaussianBlur(radius=2))

    # Cool slate tint, so the warm Grad-CAM overlay stays readable.
    r = noise.point(lambda v: int(24 + v * 0.28))
    g = noise.point(lambda v: int(30 + v * 0.32))
    b = noise.point(lambda v: int(46 + v * 0.38))
    frame = Image.merge("RGB", (r, g, b))

    draw = ImageDraw.Draw(frame)

    # Soft light source, gives the flat noise some depth.
    cx = rng.randint(int(width * 0.3), int(width * 0.7))
    cy = rng.randint(int(height * 0.2), int(height * 0.5))
    for step in range(6, 0, -1):
        radius = step * max(width, height) // 12
        shade = 8 * (7 - step)
        draw.ellipse(
            (cx - radius, cy - radius, cx + radius, cy + radius),
            fill=(24 + shade // 2, 30 + shade // 2, 48 + shade),
        )
    frame = frame.filter(ImageFilter.GaussianBlur(radius=6))

    # Head / shoulders silhouette.
    draw = ImageDraw.Draw(frame)
    face_w = int(width * rng.uniform(0.26, 0.34))
    face_h = int(face_w * 1.3)
    fx = width // 2 - face_w // 2 + rng.randint(-16, 16)
    fy = int(height * 0.22)
    draw.ellipse((fx, fy, fx + face_w, fy + face_h), fill=(72, 66, 62))
    draw.ellipse(
        (fx - face_w // 2, fy + face_h - 8, fx + face_w + face_w // 2, height + face_h),
        fill=(38, 42, 58),
    )
    frame = frame.filter(ImageFilter.GaussianBlur(radius=3))

    return frame


def _heat_mask(rng: random.Random, size: tuple[int, int], intensity: float) -> Image.Image:
    """Grayscale activation mask with 2-4 blobs clustered around the face."""
    width, height = size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)

    blobs = rng.randint(2, 4)
    for _ in range(blobs):
        bx = rng.randint(int(width * 0.32), int(width * 0.68))
        by = rng.randint(int(height * 0.22), int(height * 0.72))
        rx = rng.randint(int(width * 0.06), int(width * 0.16))
        ry = int(rx * rng.uniform(0.7, 1.3))
        peak = int(120 + 135 * intensity * rng.uniform(0.6, 1.0))
        draw.ellipse((bx - rx, by - ry, bx + rx, by + ry), fill=min(255, peak))

    return mask.filter(ImageFilter.GaussianBlur(radius=max(width, height) // 16))


def _colorize_heat(mask: Image.Image) -> Image.Image:
    """Jet-ish ramp: transparent blue -> green -> yellow -> red."""
    r = mask.point(lambda v: max(0, min(255, int((v - 96) * 2.6))))
    g = mask.point(lambda v: max(0, min(255, int(255 - abs(v - 150) * 2.0))))
    b = mask.point(lambda v: max(0, min(255, int(220 - v * 1.4))))
    return Image.merge("RGB", (r, g, b))


def render_gradcam_frames(
    output_dir: Path,
    count: int,
    intensity: float,
    seed: int | None = None,
) -> list[str]:
    """Write ``count`` Grad-CAM style JPEGs into ``output_dir``.

    Args:
        intensity: 0-1, how hot the activations look (drives the visual score).

    Returns:
        File names, relative to ``output_dir``.
    """
    rng = random.Random(seed)
    output_dir.mkdir(parents=True, exist_ok=True)

    names: list[str] = []
    for index in range(count):
        frame = _base_frame(rng, FRAME_SIZE)
        mask = _heat_mask(rng, FRAME_SIZE, intensity)
        heat = _colorize_heat(mask)

        blended = Image.composite(
            Image.blend(frame, heat, 0.72),
            frame,
            mask.point(lambda v: min(255, int(v * 1.1))),
        )

        draw = ImageDraw.Draw(blended)
        draw.rectangle((0, FRAME_SIZE[1] - 22, FRAME_SIZE[0], FRAME_SIZE[1]), fill=(10, 13, 20))
        draw.text((8, FRAME_SIZE[1] - 16), f"frame {index * 12 + 4:04d}", fill=(190, 200, 220))
        draw.rectangle((0, 0, FRAME_SIZE[0] - 1, FRAME_SIZE[1] - 1), outline=(60, 70, 92))

        name = f"gradcam_{index + 1:02d}.jpg"
        blended.save(output_dir / name, "JPEG", quality=86)
        names.append(name)

    return names


def render_thumbnail(output_dir: Path, seed: int | None = None, name: str = "thumb.jpg") -> str:
    """Write a poster-frame style thumbnail; returns its file name."""
    rng = random.Random(seed)
    output_dir.mkdir(parents=True, exist_ok=True)

    frame = _base_frame(rng, THUMB_SIZE)
    draw = ImageDraw.Draw(frame)
    cx, cy = THUMB_SIZE[0] // 2, THUMB_SIZE[1] // 2
    draw.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=(12, 16, 24))
    draw.polygon([(cx - 8, cy - 13), (cx - 8, cy + 13), (cx + 14, cy)], fill=(226, 232, 240))

    frame.save(output_dir / name, "JPEG", quality=84)
    return name
