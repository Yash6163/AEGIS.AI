"""Risk engine: turns model outputs into risk, levels and uncertainty.

Three quantities are kept strictly separate:

* attack / compromise probability - model outputs: P(any attack state, or any
  compromise-class state, among s_{t+1..t+K}), estimated from sampled
  trajectories;
* model confidence - how peaked the predicted distributions are
  (1 - normalised entropy) plus the Monte-Carlo standard error;
* risk score - a documented POLICY layer (not learned) combining the
  probabilities with analyst-defined state severities.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .states import ATTACK_STATES, COMPROMISE_STATES, SEVERITY, STATE_NAMES

RISK_LEVELS = [(75.0, "CRITICAL"), (50.0, "HIGH"), (25.0, "MEDIUM"), (0.0, "LOW")]
UNCERTAIN_ENTROPY = 0.6  # normalised entropy above which a step is flagged uncertain
UNCERTAIN_MAX_PROB = 0.5


def risk_level(score: float) -> str:
    return next(level for thr, level in RISK_LEVELS if score >= thr)


def normalised_entropy(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-12, 1)
    return -(p * np.log(p)).sum(-1) / np.log(p.shape[-1])


def first_hit(paths: np.ndarray, states: list[int]) -> tuple[float, float | None]:
    """P(hit any of `states` in steps 1..K) and expected first-hit step given a hit."""
    hit = np.isin(paths[:, 1:], states)
    any_hit = hit.any(axis=1)
    if not any_hit.any():
        return 0.0, None
    first = hit[any_hit].argmax(axis=1) + 1
    return float(any_hit.mean()), float(first.mean())


@dataclass
class RiskAssessment:
    risk_score: float
    risk_level: str
    attack_probability: float
    compromise_probability: float
    expected_minutes_to_attack: float | None
    expected_minutes_to_compromise: float | None
    expected_peak_severity: float
    current_severity: float
    confidence: float
    mc_standard_error: float
    uncertain: bool
    uncertainty_reasons: list[str]


def assess(nowcast: np.ndarray, marginals: np.ndarray, paths: np.ndarray, out_of_distribution: bool = False) -> RiskAssessment:
    """Risk for a single host.

    nowcast (S,), marginals (K+1, S), paths (N, K+1) sampled trajectories.
    risk = 100 * max(current expected severity, E[max severity over the horizon]).
    """
    sev = np.asarray(SEVERITY)
    n = paths.shape[0]
    current_sev = float(nowcast @ sev)
    peak = sev[paths[:, 1:]].max(axis=1)
    expected_peak = float(peak.mean())
    score = 100.0 * max(current_sev, expected_peak)
    p_attack, t_attack = first_hit(paths, ATTACK_STATES)
    p_comp, t_comp = first_hit(paths, COMPROMISE_STATES)

    ent = normalised_entropy(marginals[1:])
    conf = float(1.0 - ent.mean())
    se = float(np.sqrt(max(p_attack * (1 - p_attack), 1e-12) / n))
    reasons = []
    if ent[0] > UNCERTAIN_ENTROPY or marginals[1].max() < UNCERTAIN_MAX_PROB:
        reasons.append("next-minute state distribution is diffuse")
    if out_of_distribution:
        reasons.append("input traffic is far outside the training distribution")
    return RiskAssessment(
        risk_score=round(score, 1),
        risk_level=risk_level(score),
        attack_probability=p_attack,
        compromise_probability=p_comp,
        expected_minutes_to_attack=t_attack,
        expected_minutes_to_compromise=t_comp,
        expected_peak_severity=expected_peak,
        current_severity=current_sev,
        confidence=conf,
        mc_standard_error=se,
        uncertain=bool(reasons),
        uncertainty_reasons=reasons,
    )


def step_labels(marginals: np.ndarray) -> list[dict]:
    """Per-step summary: most likely state, its probability, entropy, flag."""
    out = []
    ent = normalised_entropy(marginals)
    for k, p in enumerate(marginals):
        i = int(p.argmax())
        out.append({
            "step": k,
            "state": STATE_NAMES[i],
            "probability": float(p[i]),
            "entropy": float(ent[k]),
            "confidence_band": "HIGH" if p[i] >= 0.8 else ("MEDIUM" if p[i] >= UNCERTAIN_MAX_PROB else "UNCERTAIN"),
            "distribution": {STATE_NAMES[j]: float(v) for j, v in enumerate(p)},
        })
    return out
