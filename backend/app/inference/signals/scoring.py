"""Shared helpers for turning raw measurements into [0, 1] suspicion scores.

Every operating point in this package is **hand-set**, not learned from a
labelled corpus. The ramps below are the single place that judgement happens,
so they are easy to find, document and re-tune.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

import numpy as np


def ramp(value: float, clean: float, suspicious: float) -> float:
    """Map a measurement onto [0, 1] by linear interpolation between two anchors.

    ``clean`` is the value typical of untouched footage and ``suspicious`` the
    value typical of manipulated footage. ``suspicious`` may be lower than
    ``clean`` -- the ramp simply runs the other way.

    Args:
        value: the raw measurement.
        clean: measurement anchor scoring 0.0.
        suspicious: measurement anchor scoring 1.0.

    Returns:
        A score in [0, 1], clamped at both ends.
    """
    if not np.isfinite(value):
        return 0.5  # a feature we could not measure should not swing the result
    if clean == suspicious:
        return 0.5
    position = (value - clean) / (suspicious - clean)
    return float(min(1.0, max(0.0, position)))


def combine(parts: dict[str, float], weights: dict[str, float]) -> float:
    """Weighted mean of the features that were actually measured.

    Features missing from ``parts`` (because the signal was unavailable) drop
    out of both the numerator and the denominator, so an unmeasurable feature
    dilutes nothing.
    """
    total = sum(weights[key] for key in parts if key in weights)
    if total <= 0:
        return 0.5
    return float(sum(parts[key] * weights[key] for key in parts if key in weights) / total)


def robust_mean(values: Sequence[float] | Iterable[float]) -> float:
    """Mean of the interquartile range -- resistant to a few wild frames."""
    array = np.asarray([v for v in values if np.isfinite(v)], dtype=np.float64)
    if array.size == 0:
        return float("nan")
    if array.size < 4:
        return float(array.mean())
    lower, upper = np.percentile(array, [25, 75])
    trimmed = array[(array >= lower) & (array <= upper)]
    return float(trimmed.mean() if trimmed.size else array.mean())


def describe_level(score: float, ladder: Sequence[tuple[float, str, str]]) -> tuple[str, str]:
    """Pick the (label, explanation) whose upper bound first exceeds ``score``."""
    for threshold, label, explanation in ladder:
        if score < threshold:
            return label, explanation
    return ladder[-1][1], ladder[-1][2]
