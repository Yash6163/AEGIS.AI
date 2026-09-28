"""Forecast engine: one call turns a host's feature history into a forecast."""

from __future__ import annotations

import time
from collections import Counter
from dataclasses import asdict
from pathlib import Path

import numpy as np

from .explain import explain as explain_forecast
from .risk import assess, step_labels
from .runtime import EnsembleRuntime, WorldModelRuntime, load_runtime
from .states import ATTACK_STATES, COMPROMISE_STATES, STATE_INFO, STATE_NAMES, AttackState

TREE_DEPTH = 4
TREE_MIN_PROB = 0.03


def _tree(paths: np.ndarray, depth: int, min_prob: float) -> dict:
    """Branching tree of sampled trajectories (step 0 = current state).

    Every node carries the joint probability of its path prefix and the
    probability conditional on its parent. Branches below `min_prob` are
    merged into an OTHER node so the displayed mass always sums to 1.
    """
    n = len(paths)

    def build(idx: np.ndarray, step: int) -> list[dict]:
        if step > depth or len(idx) == 0:
            return []
        counts = Counter(paths[idx, step].tolist())
        nodes, other = [], 0
        for s, c in counts.most_common():
            if c / n < min_prob:
                other += c
                continue
            child = idx[paths[idx, step] == s]
            nodes.append({
                "state": STATE_NAMES[s], "step": step,
                "probability": c / n, "conditional_probability": c / len(idx),
                "children": build(child, step + 1),
            })
        if other:
            nodes.append({"state": "OTHER", "step": step, "probability": other / n,
                          "conditional_probability": other / len(idx), "children": []})
        return nodes

    return {"depth": depth, "min_probability": min_prob, "roots": build(np.arange(n), 0)}


def _top_paths(paths: np.ndarray, k: int = 5) -> list[dict]:
    counts = Counter(map(tuple, paths.tolist()))
    return [{"states": [STATE_NAMES[s] for s in p], "probability": c / len(paths)} for p, c in counts.most_common(k)]


class ForecastEngine:
    def __init__(self, runtime: WorldModelRuntime | EnsembleRuntime):
        self.rt = runtime
        self.manifest = runtime.manifest
        ew = self.manifest.get("early_warning", {})
        self.warning_horizon = int(ew.get("horizon", 5))
        self.warning_threshold = float(ew.get("threshold", 0.5))
        self.ood_p999 = float(self.manifest.get("ood_reference", {}).get("p999", np.inf))

    @classmethod
    def load(cls, artifact_dir: str | Path) -> ForecastEngine:
        return cls(load_runtime(artifact_dir))

    @property
    def version(self) -> str:
        return str(self.manifest.get("model_version", "unknown"))

    def prepare_history(self, history: np.ndarray) -> tuple[np.ndarray, int]:
        """Left-pad with no-traffic windows (raw zeros) up to the model history."""
        history = np.asarray(history, dtype=np.float64)
        L = self.rt.history
        if history.ndim != 2 or history.shape[1] != len(self.rt.mean):
            raise ValueError(f"history must have shape (n, {len(self.rt.mean)})")
        history = history[-L:]
        pad = L - len(history)
        if pad > 0:
            history = np.vstack([np.zeros((pad, history.shape[1])), history])
        return history, pad

    def ood_score(self, history_raw: np.ndarray) -> float:
        """Max |z| of the latest window, relative to the training p99.9 (1.0 = at p99.9)."""
        z = np.abs(self.rt.standardise(history_raw[-1])).max()
        return float(z / self.ood_p999) if np.isfinite(self.ood_p999) else float(z)

    # ------------------------------------------------------------ batch
    def summarise(self, histories: np.ndarray, n_samples: int = 128, seed: int = 0) -> list[dict]:
        """Cheap per-host summaries for many (host, window) histories at once.

        histories: (B, L, F) raw features. Used for timelines and snapshots.
        """
        if len(histories) == 0:
            return []
        H = max(self.warning_horizon, 1)
        x = self.rt.standardise(histories)
        h = self.rt.encode(x)
        r = self.rt.rollout(x, H, n_samples, seed=seed, h0=h)
        _, p1 = self.rt.next_state_exact(h)
        p_attack = self.rt.attack_within_exact(h, H)
        out = []
        for i in range(len(histories)):
            a = assess(r.nowcast[i], r.marginals[i], r.paths[i], attack_probability=p_attack[i])
            cur, nxt = int(r.nowcast[i].argmax()), int(p1[i].argmax())
            out.append({
                "current_state": STATE_NAMES[cur], "current_probability": float(r.nowcast[i, cur]),
                "next_state": STATE_NAMES[nxt], "next_probability": float(p1[i, nxt]),
                "attack_probability": a.attack_probability, "compromise_probability": a.compromise_probability,
                "risk_score": a.risk_score, "risk_level": a.risk_level,
                "warning": a.attack_probability >= self.warning_threshold,
            })
        return out

    # ------------------------------------------------------------ single
    def forecast(
        self,
        history_raw: np.ndarray,
        horizon: int = 5,
        n_samples: int = 512,
        seed: int = 0,
        with_explanation: bool = True,
    ) -> dict:
        t0 = time.perf_counter()
        hist, padded = self.prepare_history(history_raw)
        K = max(horizon, self.warning_horizon)
        x = self.rt.standardise(hist)[None]
        h = self.rt.encode(x)
        r = self.rt.rollout(x, K, n_samples, seed=seed, h0=h)
        paths, marg, now = r.paths[0], r.marginals[0], r.nowcast[0]
        ood = self.ood_score(hist)
        risk = assess(now, marg[:horizon + 1], paths[:, :horizon + 1], out_of_distribution=ood > 1.0,
                      attack_probability=float(self.rt.attack_within_exact(h, horizon)[0]))
        warn_p = float(self.rt.attack_within_exact(h, self.warning_horizon)[0])
        cur = int(now.argmax())
        result = {
            "model_version": self.version,
            "horizon": horizon,
            "window_seconds": int(self.manifest.get("window_seconds", 60)),
            "history_windows": self.rt.history,
            "history_padded": padded,
            "mc_samples": n_samples,
            "current": {
                "state": STATE_NAMES[cur], "probability": float(now[cur]),
                "distribution": {STATE_NAMES[j]: float(v) for j, v in enumerate(now)},
            },
            "steps": step_labels(marg[:horizon + 1]),
            "risk": asdict(risk),
            "early_warning": {
                "horizon": self.warning_horizon, "probability": warn_p,
                "threshold": self.warning_threshold, "triggered": warn_p >= self.warning_threshold,
            },
            "trajectory_tree": _tree(paths, min(TREE_DEPTH, horizon), TREE_MIN_PROB),
            "top_trajectories": _top_paths(paths[:, :horizon + 1]),
            "ood": {"score": ood, "flagged": ood > 1.0,
                    "meaning": "max |z| of latest window relative to the 99.9th percentile seen in training"},
        }
        if with_explanation:
            result["explanation"] = explain_forecast(self.rt, hist)
        result["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        return result


def state_catalogue() -> list[dict]:
    return [
        {
            "state": s.name, "label": STATE_INFO[s].label, "severity": STATE_INFO[s].severity,
            "compromise": STATE_INFO[s].compromise, "attack": int(s) in ATTACK_STATES,
            "mitre_tactic": STATE_INFO[s].mitre_tactic, "mitre_tactic_id": STATE_INFO[s].mitre_tactic_id,
            "description": STATE_INFO[s].description,
        }
        for s in AttackState
    ]


__all__ = ["ForecastEngine", "state_catalogue", "COMPROMISE_STATES"]
