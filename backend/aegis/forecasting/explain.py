"""Per-forecast explanations computed from the model itself.

* Evidence: the host's latest-window features compared with the training
  distribution (z-scores). This is *what was observed*, not a model claim.
* Feature attribution (occlusion): replace one feature by its training mean in
  every history window and measure how much the exact probability of the
  predicted next state changes. Positive = the observed values of that
  feature push the model towards its forecast.
* Temporal attribution: replace one whole history minute by the training mean
  and measure the same change - which past minutes drove the forecast.

All quantities use exact (enumerated) one-step marginals, so explanations are
deterministic and free of Monte-Carlo noise.
"""

from __future__ import annotations

import numpy as np

from .features import FEATURE_DESCRIPTIONS, FEATURE_NAMES, PORTABLE_DESCRIPTIONS
from .runtime import EnsembleRuntime, WorldModelRuntime
from .states import STATE_NAMES

DESCRIPTIONS = {**FEATURE_DESCRIPTIONS, **PORTABLE_DESCRIPTIONS}
# features stored as log1p(count); shown to analysts in natural units (ratios excluded)
_LOG1P = {n for n in DESCRIPTIONS if n.startswith("log_") and "ratio" not in n}


def natural_value(name: str, value: float) -> float:
    return float(np.expm1(value)) if name in _LOG1P else float(value)


def explain(rt: WorldModelRuntime | EnsembleRuntime, x_raw: np.ndarray, top_k: int = 8) -> dict:
    """x_raw: (L, F) raw (unstandardised) feature history of one host."""
    names = list(rt.manifest.get("features") or FEATURE_NAMES)
    x = rt.standardise(x_raw)[None]  # (1, L, F)
    L, F = x.shape[1], x.shape[2]
    _, p1 = rt.next_state_exact(rt.encode(x))
    target = int(p1[0].argmax())
    base = float(p1[0, target])
    base_attack = float(1.0 - p1[0, 0])

    # feature occlusion: F variants in one batch
    occl = np.repeat(x, F, axis=0)
    occl[np.arange(F), :, np.arange(F)] = 0.0
    _, p1f = rt.next_state_exact(rt.encode(occl))
    feat_delta = base - p1f[:, target]
    attack_delta = base_attack - (1.0 - p1f[:, 0])

    # temporal occlusion: L variants
    tocc = np.repeat(x, L, axis=0)
    tocc[np.arange(L), np.arange(L), :] = 0.0
    _, p1t = rt.next_state_exact(rt.encode(tocc))
    time_delta = base - p1t[:, target]

    order = np.argsort(-np.abs(feat_delta))[:top_k]
    z_last = x[0, -1]
    evidence_order = np.argsort(-np.abs(z_last))[:top_k]
    return {
        "method": "occlusion to training mean; exact next-minute marginal",
        "target_state": STATE_NAMES[target],
        "target_probability": base,
        "feature_contributions": [
            {
                "feature": names[j],
                "description": DESCRIPTIONS.get(names[j], names[j]),
                "contribution": float(feat_delta[j]),
                "attack_contribution": float(attack_delta[j]),
            }
            for j in order
        ],
        "temporal_contributions": [
            {"minutes_ago": int(L - 1 - i), "contribution": float(time_delta[i])} for i in range(L)
        ],
        "evidence": [
            {
                "feature": names[j],
                "description": DESCRIPTIONS.get(names[j], names[j]),
                "observed": natural_value(names[j], float(x_raw[-1, j])),
                "training_mean": natural_value(names[j], float(rt.mean[j])),
                "z_score": float(z_last[j]),
            }
            for j in evidence_order
        ],
    }
