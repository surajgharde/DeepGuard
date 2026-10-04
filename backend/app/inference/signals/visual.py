"""Visual manipulation features, measured on real decoded frames.

Five classical forensic signals, each computed from pixels in the uploaded
file and each mapped onto [0, 1] by a hand-set ramp in :mod:`scoring`:

``sharpness``  A pasted face is usually rendered at lower resolution than the
               frame it lands in, so it carries less high-frequency detail than
               the surrounding image.
``spectral``   Generator upsampling suppresses the top of the 2-D spectrum;
               synthesised faces are measurably smoother than camera output.
``seam``       Blending a face into a frame leaves a gradient discontinuity
               along the blend boundary.
``flicker``    Frame-by-frame generation is not temporally smooth. Real motion
               accelerates gently, so a face's second temporal difference is
               small next to its first; independently generated frames jitter,
               pushing that ratio up.

None of these thresholds were fitted to a labelled corpus -- see the module
docstring in :mod:`app.inference.heuristic` for what that means for the output.

Dropped on purpose
------------------
A fifth feature comparing the *sensor-noise floor* inside the face against its
surroundings was implemented and then removed: it saturated on every genuine
clip tested. The comparison is confounded at the source, because H.264/H.265
encoders deliberately spend more bits on faces than on backgrounds, so the two
regions have systematically different residual statistics in all real video,
manipulated or not. :func:`_noise_floor` is kept because the block-percentile
estimator is the right tool if the comparison is ever reformulated to compare
like with like -- swapped face against preserved neck, both skin, both given
the same codec treatment.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np

from app.inference.signals.scan import FrameSample, VideoScan
from app.inference.signals.scoring import combine, describe_level, ramp, robust_mean

# Operating points: (clean anchor -> 0.0, suspicious anchor -> 1.0).
#
# The clean anchors were set by measuring genuine camera footage, so ordinary
# video lands near 0. The suspicious anchors are reasoned from what each
# artefact looks like when present -- they are NOT fitted to labelled fakes,
# because no labelled corpus was available. Treat the upper half of each ramp
# as informed judgement rather than a calibrated boundary.
_ANCHORS: dict[str, tuple[float, float]] = {
    "sharpness": (0.60, -0.60),  # log(face detail / surrounding detail)
    "spectral": (-19.0, -32.0),  # high-band vs mid-band power, dB
    "seam": (0.90, 1.50),  # boundary gradient vs interior+exterior baseline
    "flicker": (1.05, 1.75),  # face acceleration relative to face velocity
}

_WEIGHTS: dict[str, float] = {
    "sharpness": 0.26,
    "spectral": 0.28,
    "seam": 0.22,
    "flicker": 0.24,
}

_LADDER: tuple[tuple[float, str, str], ...] = (
    (0.25, "Consistent", "Detail, spectrum and temporal motion are consistent across the face and its surroundings."),
    (0.50, "Mostly consistent", "Minor irregularities, within the range of ordinary compression."),
    (0.75, "Suspicious", "The face carries less detail than its surroundings and moves less smoothly than real motion."),
    (1.01, "Strong artefacts", "Clear blending boundary and suppressed high-frequency detail on the face."),
)


@dataclass(slots=True)
class VisualAnalysis:
    score: float
    label: str
    explanation: str
    features: dict[str, float] = field(default_factory=dict)
    raw: dict[str, float] = field(default_factory=dict)
    face_ratio: float = 0.0
    reliability: str = "ok"


def _ellipse_mask(shape: tuple[int, int], box: tuple[int, int, int, int], scale: float) -> np.ndarray:
    """Filled ellipse inscribed in ``box``, grown/shrunk by ``scale``."""
    x, y, w, h = box
    mask = np.zeros(shape, dtype=np.uint8)
    centre = (x + w // 2, y + h // 2)
    axes = (max(1, int(w * scale / 2)), max(1, int(h * scale / 2)))
    cv2.ellipse(mask, centre, axes, 0, 0, 360, 255, -1)
    return mask


def _masked_var(values: np.ndarray, mask: np.ndarray) -> float:
    selected = values[mask > 0]
    return float(selected.var()) if selected.size > 32 else float("nan")


def _noise_floor(residual: np.ndarray, mask: np.ndarray, block: int = 8) -> float:
    """Sensor-noise estimate for a masked region, isolated from texture.

    A plain spread over the whole region measures texture, not noise: eyes,
    lips and hair edges make the face's residual several times larger than a
    smooth wall behind it, which swamps any manipulation signal. Instead the
    region is tiled into small blocks and the *low percentile* of block
    activity is taken -- flat blocks contain noise and nothing else, so they
    estimate the noise floor while textured blocks are discarded.
    """
    ys, xs = np.nonzero(mask)
    if ys.size <= 256:
        return float("nan")
    top, bottom, left, right = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1

    patch = np.abs(residual[top:bottom, left:right])
    covered = mask[top:bottom, left:right] > 0

    height = (patch.shape[0] // block) * block
    width = (patch.shape[1] // block) * block
    if height < block or width < block:
        return float("nan")

    tiles = patch[:height, :width].reshape(height // block, block, width // block, block)
    inside = covered[:height, :width].reshape(height // block, block, width // block, block)

    activity = tiles.mean(axis=(1, 3))
    # Only trust blocks that lie (almost) entirely within the region.
    usable = inside.mean(axis=(1, 3)) > 0.9
    values = activity[usable]
    if values.size < 6:
        return float("nan")
    return float(np.percentile(values, 20))


def _masked_mean(values: np.ndarray, mask: np.ndarray) -> float:
    selected = values[mask > 0]
    return float(selected.mean()) if selected.size > 32 else float("nan")


def _spectral_ratio_db(crop: np.ndarray) -> float:
    """High-band vs mid-band radial power of the face crop, in dB."""
    size = crop.shape[0]
    window = np.outer(np.hanning(crop.shape[0]), np.hanning(crop.shape[1]))
    spectrum = np.fft.fftshift(np.fft.fft2(crop.astype(np.float64) * window))
    power = np.abs(spectrum) ** 2

    cy, cx = np.array(power.shape) // 2
    yy, xx = np.ogrid[: power.shape[0], : power.shape[1]]
    radius = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2) / (size / 2.0)

    mid = power[(radius >= 0.12) & (radius < 0.30)]
    high = power[(radius >= 0.55) & (radius < 0.85)]
    if mid.size == 0 or high.size == 0 or mid.mean() <= 0 or high.mean() <= 0:
        return float("nan")
    return float(10.0 * np.log10(high.mean() / mid.mean()))


def _frame_features(frame: FrameSample) -> dict[str, float]:
    """Per-frame raw measurements; keys missing when they cannot be computed."""
    out: dict[str, float] = {}
    if frame.face_box is None:
        return out

    gray = frame.gray
    shape = gray.shape[:2]
    face = _ellipse_mask(shape, frame.face_box, 0.92)
    inner = _ellipse_mask(shape, frame.face_box, 0.82)
    outer = _ellipse_mask(shape, frame.face_box, 1.00)
    context = cv2.subtract(
        _ellipse_mask(shape, frame.face_box, 1.55),
        _ellipse_mask(shape, frame.face_box, 1.12),
    )
    boundary = cv2.subtract(outer, inner)

    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    face_var = _masked_var(laplacian, face)
    context_var = _masked_var(laplacian, context)
    if np.isfinite(face_var) and np.isfinite(context_var) and face_var > 0 and context_var > 0:
        out["sharpness"] = float(np.log(face_var / context_var))

    crop = frame.face_crop()
    if crop is not None:
        value = _spectral_ratio_db(crop)
        if np.isfinite(value):
            out["spectral"] = value

    sobel = cv2.magnitude(
        cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3),
        cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3),
    )
    edge_boundary = _masked_mean(sobel, boundary)
    edge_face = _masked_mean(sobel, inner)
    edge_context = _masked_mean(sobel, context)
    baseline = np.nanmean([edge_face, edge_context])
    if np.isfinite(edge_boundary) and np.isfinite(baseline) and baseline > 1e-6:
        out["seam"] = float(edge_boundary / baseline)

    return out


def _flicker(window: list[FrameSample]) -> list[float]:
    """Temporal jitter of the face: second difference against first difference.

    Gross motion is not the signal here -- a real talking head moves far more
    than its static background, so a plain face-vs-frame motion ratio just
    measures "there is a person in shot". What separates generated footage is
    *smoothness*: real movement carries momentum, so ``|f[t] - 2f[t-1] +
    f[t-2]|`` stays well below ``|f[t] - f[t-1]|``. Frames generated one at a
    time have no such continuity and the ratio climbs toward 2.
    """
    values: list[float] = []
    for first, second, third in zip(window, window[1:], window[2:]):
        boxes = (first.face_box, second.face_box, third.face_box)
        if any(box is None for box in boxes) or len(set(boxes)) != 1:
            continue  # the box moved; diffs would measure re-framing, not jitter
        crops = [frame.face_crop() for frame in (first, second, third)]
        if any(crop is None for crop in crops):
            continue
        # Blur before differencing. At pixel level, frame-to-frame change in any
        # compressed video is dominated by codec noise, which is temporally
        # independent and drives the ratio to its ~1.73 noise ceiling whatever
        # the content. Smoothing suppresses that so the ratio reflects the
        # motion of face *structure*, which is what generation disrupts.
        a, b, c = (
            cv2.GaussianBlur(crop.astype(np.float64), (0, 0), 2.0)  # type: ignore[union-attr]
            for crop in crops
        )

        velocity = np.abs(c - b).mean() + np.abs(b - a).mean()
        if velocity < 0.6:
            continue  # a frozen face; the ratio is numerically meaningless
        acceleration = float(np.abs(c - 2.0 * b + a).mean())
        values.append(acceleration / (velocity / 2.0))
    return values


def artefact_map(frame: FrameSample) -> np.ndarray:
    """Per-pixel suspicion map for the overlay renderer.

    Blockwise local high-frequency deficit combined with residual-noise
    anomaly, normalised to [0, 1]. This is a direct measurement of the frame,
    not a network gradient -- it is not Grad-CAM and is not labelled as such.
    """
    gray = frame.gray
    height, width = gray.shape[:2]

    detail = np.abs(cv2.Laplacian(gray, cv2.CV_64F))
    residual = np.abs(gray.astype(np.float64) - cv2.medianBlur(gray, 3).astype(np.float64))

    block = max(8, min(height, width) // 24)
    small = (max(1, width // block), max(1, height // block))
    detail_small = cv2.resize(detail, small, interpolation=cv2.INTER_AREA)
    residual_small = cv2.resize(residual, small, interpolation=cv2.INTER_AREA)

    def _z(values: np.ndarray) -> np.ndarray:
        centre = float(np.median(values))
        spread = float(1.4826 * np.median(np.abs(values - centre))) or 1.0
        return (values - centre) / spread

    # Suspicion rises where local detail is unusually low but residual noise is
    # not correspondingly low -- i.e. smoothed content that is not simply flat.
    suspicion = np.clip(-_z(detail_small), 0, None) + 0.6 * np.clip(_z(residual_small), 0, None)

    if frame.face_box is not None:
        # Manipulation lives on the face; weight the map toward it rather than
        # letting a busy background dominate the overlay.
        weight = _ellipse_mask(gray.shape[:2], frame.face_box, 1.25).astype(np.float64) / 255.0
        weight = cv2.resize(weight, small, interpolation=cv2.INTER_AREA)
        suspicion *= 0.25 + 0.75 * weight

    suspicion = cv2.resize(suspicion, (width, height), interpolation=cv2.INTER_CUBIC)
    suspicion = cv2.GaussianBlur(suspicion, (0, 0), sigmaX=max(width, height) / 48.0)

    peak = float(suspicion.max())
    if peak <= 1e-9:
        return np.zeros_like(suspicion)
    return np.clip(suspicion / peak, 0.0, 1.0)


def analyse_visual(scan: VideoScan) -> VisualAnalysis:
    """Aggregate the per-frame features into one visual branch score."""
    collected: dict[str, list[float]] = {key: [] for key in _ANCHORS}

    for frame in scan.face_frames:
        for key, value in _frame_features(frame).items():
            collected[key].append(value)

    for window in scan.windows:
        collected["flicker"].extend(_flicker(window))

    raw = {key: robust_mean(values) for key, values in collected.items() if values}
    features = {
        key: ramp(value, *_ANCHORS[key]) for key, value in raw.items() if np.isfinite(value)
    }

    if not features:
        return VisualAnalysis(
            score=0.5,
            label="Not assessable",
            explanation=(
                "No face could be located in the sampled frames, so no visual "
                "manipulation features could be measured."
            ),
            face_ratio=scan.face_ratio,
            reliability="no-face",
        )

    score = combine(features, _WEIGHTS)

    reliability = "ok"
    if scan.face_ratio < 0.35:
        # Few frames contributed; pull the score toward neutral rather than
        # reporting a confident number from a handful of measurements.
        score = 0.5 + (score - 0.5) * (0.4 + 0.6 * (scan.face_ratio / 0.35))
        reliability = "sparse-face"

    label, explanation = describe_level(score, _LADDER)
    if reliability == "sparse-face":
        explanation += " A face was visible in only part of the sampled frames, so confidence is reduced."

    return VisualAnalysis(
        score=float(min(0.99, max(0.01, score))),
        label=label,
        explanation=explanation,
        features=features,
        raw=raw,
        face_ratio=scan.face_ratio,
        reliability=reliability,
    )
