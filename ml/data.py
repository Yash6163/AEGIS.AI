"""Sequence construction and leakage-free blocked cross-validation.

Protocol (documented in docs/METHODOLOGY.md):
  * Each capture day is cut into contiguous time blocks of BLOCK_MINUTES.
    All hosts share the same block boundaries.
  * Blocks are assigned to N_FOLDS folds. The assignment is stratified: among
    SEARCH_SEEDS seeded random assignments we keep the one whose per-state
    window counts are most evenly spread over folds. Only labels are used for
    this, never model outputs.
  * A sample at (host, t) uses inputs x[t-L+1..t] and targets s[t..t+K]. All of
    these windows must lie inside the same block; targets that would cross the
    block end are masked (-1). Hence no window - neither its features nor its
    label - is ever shared between folds.
  * Cross-validation: fold f is test, fold (f+1) mod N is validation (early
    stopping, temperature, warning threshold), the rest is training. Every
    sample is predicted exactly once by a model that never saw its block.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from aegis.forecasting.features import FEATURE_NAMES  # noqa: E402
from aegis.forecasting.states import NUM_STATES  # noqa: E402

BLOCK_MINUTES = 30
HISTORY = 10  # L: windows of history fed to the encoder
MAX_HORIZON = 10  # K_max: forecast steps (minutes) supervised
N_FOLDS = 5
SEARCH_SEEDS = 3000
PRODUCTION_VAL_FOLD = 0


def assign_folds(windows: pd.DataFrame, block_minutes: int = BLOCK_MINUTES, n_folds: int = N_FOLDS) -> pd.DataFrame:
    """Add `pos` (minute of day), `block` (global id) and `fold` columns."""
    w = windows.copy()
    day_start = w.groupby("day")["window_start"].transform("min")
    w["pos"] = ((w["window_start"] - day_start).dt.total_seconds() // 60).astype(int)
    day_idx = w["day"].map({d: i for i, d in enumerate(w["day"].unique())})
    w["block"] = day_idx * 1000 + w["pos"] // block_minutes

    # count only windows that can be the "current" time of a sample
    eligible = w[(w["pos"] % block_minutes) >= HISTORY - 1]
    ids = np.array(sorted(w["block"].unique()))
    counts = np.zeros((len(ids), NUM_STATES), dtype=int)
    pos = {b: i for i, b in enumerate(ids)}
    for b, st in eligible.groupby("block")["state"]:
        counts[pos[b]] = np.bincount(st, minlength=NUM_STATES)
    attack = counts[:, 1:]
    total = attack.sum(0)
    weight = np.sqrt(total) / max(np.sqrt(total).sum(), 1e-9)

    best, best_score = None, None
    for seed in range(SEARCH_SEEDS):
        fold = np.random.default_rng(seed).permutation(len(ids)) % n_folds
        per = np.stack([attack[fold == f].sum(0) for f in range(n_folds)])  # folds x states
        n_testable = int(((per > 0).sum(0) >= 2).sum())  # state in >=2 folds: can train on one, test another
        share = per / np.maximum(total, 1)
        spread = float((weight * np.abs(share - 1.0 / n_folds).sum(0)).sum())
        score = (n_testable, -spread)
        if best_score is None or score > best_score:
            best, best_score = fold, score
    w["fold"] = w["block"].map(dict(zip(ids, best, strict=False))).astype(int)
    return w


@dataclass
class SequenceSet:
    X: np.ndarray  # (N, L, F) standardised features
    y: np.ndarray  # (N, K+1) states for t..t+K ; -1 where masked
    idx: np.ndarray  # (N,) row index into the windows table of time t

    def __len__(self) -> int:
        return len(self.idx)

    def subset(self, mask: np.ndarray) -> SequenceSet:
        return SequenceSet(self.X[mask], self.y[mask], self.idx[mask])


def standardiser(windows: pd.DataFrame, folds: list[int], features: list[str] = FEATURE_NAMES) -> tuple[np.ndarray, np.ndarray]:
    """Feature mean/std fitted on the given (training) folds only."""
    train = windows.loc[windows["fold"].isin(folds), features].to_numpy(np.float64)
    mean = train.mean(0)
    std = train.std(0)
    std[std < 1e-6] = 1.0
    return mean.astype(np.float32), std.astype(np.float32)


def build_sequences(
    windows: pd.DataFrame,
    mean: np.ndarray,
    std: np.ndarray,
    history: int = HISTORY,
    horizon: int = MAX_HORIZON,
    features: list[str] = FEATURE_NAMES,
) -> SequenceSet:
    """Samples for every (host, t) whose history and targets stay in one block.

    `windows` must be sorted by (day, entity, window_start) with contiguous
    per-host minutes (prepare_windows.py guarantees this).
    """
    feats = ((windows[features].to_numpy(np.float32) - mean) / std).astype(np.float32)
    states = windows["state"].to_numpy(np.int64)
    seg = pd.factorize(windows["block"].astype(str) + "|" + windows["day"].astype(str) + "|" + windows["entity"].astype(str))[0]
    n = len(windows)
    starts = np.arange(history - 1, n)
    t_idx = starts[seg[starts - history + 1] == seg[starts]]
    X = feats[t_idx[:, None] + np.arange(-history + 1, 1)[None, :]]
    fut = t_idx[:, None] + np.arange(horizon + 1)[None, :]
    fut_c = np.minimum(fut, n - 1)
    y = np.where((fut < n) & (seg[fut_c] == seg[t_idx][:, None]), states[fut_c], -1)
    return SequenceSet(X.astype(np.float32), y.astype(np.int64), t_idx)


def fold_split(windows: pd.DataFrame, test_fold: int | None, val_fold: int, n_folds: int = N_FOLDS):
    """(train_folds, val_fold, test_fold). test_fold=None -> production split."""
    train = [f for f in range(n_folds) if f not in (test_fold, val_fold)]
    return train, val_fold, test_fold


def load_windows(path: str | Path = "data/processed/windows.parquet") -> pd.DataFrame:
    w = pd.read_parquet(path).sort_values(["day", "entity", "window_start"], kind="stable")
    return assign_folds(w.reset_index(drop=True)).reset_index(drop=True)
