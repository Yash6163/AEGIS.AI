"""Hyper-parameter selection on VALIDATION folds only.

For each config and each CV fold f the model is trained on the training folds
and scored on validation fold (f+1) mod 5. Test folds are never touched, so
the cross-validated test metrics in evaluate.py remain unbiased.

Usage: python ml/tune.py
"""

from __future__ import annotations

from xgboost import XGBClassifier  # noqa: F401  # isort: skip  (import before torch, see evaluate.py)

import itertools
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import average_precision_score, f1_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "ml"))

import data as D  # noqa: E402
import train as TR  # noqa: E402

GRID = {
    "HIDDEN": [32, 64],
    "DROPOUT": [0.2, 0.4],
    "SELECT": ["weighted", "unweighted"],
    "INPUT_CLIP": [0.0, 8.0],
}
FIXED = {"LR": 1e-3, "WEIGHT_DECAY": 1e-3}


def score(rt, va) -> dict:
    h = rt.encode(va.X)
    p0, p1 = rt.next_state_exact(h)
    m1 = va.y[:, 1] >= 0
    y0, y1 = va.y[:, 0], va.y[m1, 1]
    r = rt.rollout(va.X, 5, 128, seed=3, h0=h)
    fut = va.y[:, 1:6]
    valid = fut[:, -1] >= 0
    target = (fut[valid] > 0).any(1)
    s = TR.attack_within(r.paths, 5)[valid]
    return {
        "f1_k0": f1_score(y0, p0.argmax(1), average="macro", labels=sorted(set(y0.tolist())), zero_division=0),
        "f1_k1": f1_score(y1, p1[m1].argmax(1), average="macro", labels=sorted(set(y1.tolist())), zero_division=0),
        "ew_auprc": average_precision_score(target, s) if target.any() else float("nan"),
    }


def main() -> None:
    torch.set_num_threads(4)
    windows = D.load_windows()
    fold_of_row = windows["fold"].to_numpy()
    folds = []
    for f in range(D.N_FOLDS):
        train_folds, val_fold, _ = D.fold_split(windows, f, (f + 1) % D.N_FOLDS)
        mean, std = D.standardiser(windows, train_folds)
        seqs = D.build_sequences(windows, mean, std)
        fo = fold_of_row[seqs.idx]
        folds.append((mean, std, seqs.subset(np.isin(fo, train_folds)), seqs.subset(fo == val_fold)))
    results = []
    for k, v in FIXED.items():
        setattr(TR, k, v)
    keys = list(GRID)
    for values in itertools.product(*GRID.values()):
        cfg = dict(zip(keys, values, strict=False))
        for k, v in cfg.items():
            setattr(TR, k, v)
        t0 = time.time()
        per = []
        for f, (mean, std, tr, va) in enumerate(folds):
            model, _, epoch = TR.train_world_model(f, tr, va)
            s = score(TR.to_runtime(model, mean, std), va)
            s["epoch"] = epoch
            per.append(s)
        agg = {k: float(np.nanmean([p[k] for p in per])) for k in per[0]}
        results.append({"config": cfg, **agg})
        print(json.dumps({**cfg, **{k: round(v, 3) for k, v in agg.items()}}), f"({time.time() - t0:.0f}s)", flush=True)
    results.sort(key=lambda r: -(r["f1_k1"] + r["ew_auprc"]))
    (ROOT / "data" / "processed" / "tuning.json").write_text(json.dumps(results, indent=1))
    print("best:", results[0])


if __name__ == "__main__":
    main()
