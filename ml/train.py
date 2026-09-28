"""Stage 2: train the production attack-state world model and export it.

  * training folds = all except PRODUCTION_VAL_FOLD, which is used for early
    stopping, temperature calibration and the early-warning threshold
  * N_SEEDS seeds; the production model is the seed with the lowest
    validation loss (generalisation is estimated separately by evaluate.py
    with 5-fold blocked cross-validation of this same procedure)
  * exports models/<version>/{weights.npz, manifest.json}

Usage: python ml/train.py [--version aegis-wm-1.0.0]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "ml"))

import data as D  # noqa: E402
from model import AttackWorldModel  # noqa: E402

from aegis.forecasting.features import FEATURE_NAMES  # noqa: E402
from aegis.forecasting.runtime import WorldModelRuntime  # noqa: E402
from aegis.forecasting.states import ATTACK_STATES, NUM_STATES, STATE_NAMES  # noqa: E402

N_SEEDS = 3
# Selected by ml/tune.py on validation folds (see models/<version>/tuning.json)
HIDDEN, STATE_EMB, DROPOUT = 64, 16, 0.4
LR, WEIGHT_DECAY, BATCH, MAX_EPOCHS, PATIENCE = 1e-3, 1e-3, 128, 120, 15
SELECT = "unweighted"  # early-stopping criterion: class-weighted or plain validation NLL
INPUT_CLIP = 0.0  # >0: clip standardised features to [-c, c] (model and runtime)
WARNING_HORIZON = 5
TARGET_FALSE_ALARM_RATE = 0.02
MC_SAMPLES_FIT = 256


def class_weights(y: np.ndarray) -> torch.Tensor:
    """sqrt inverse-frequency weights over states present in training."""
    counts = np.bincount(y[y >= 0], minlength=NUM_STATES).astype(np.float64)
    w = np.where(counts > 0, (counts.sum() / np.maximum(counts, 1)) ** 0.5, 0.0)
    w = w / w[counts > 0].mean()
    return torch.tensor(w, dtype=torch.float32)


def seq_loss(logits: torch.Tensor, y: torch.Tensor, weights: torch.Tensor | None) -> torch.Tensor:
    flat_logits, flat_y = logits.reshape(-1, logits.shape[-1]), y.reshape(-1)
    mask = flat_y >= 0
    return nn.functional.cross_entropy(flat_logits[mask], flat_y[mask], weight=weights)


def train_world_model(seed: int, train: D.SequenceSet, val: D.SequenceSet, verbose: bool = False):
    """Returns (model, best_val_loss, best_epoch)."""
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    model = AttackWorldModel(len(FEATURE_NAMES), NUM_STATES, HIDDEN, STATE_EMB, DROPOUT, INPUT_CLIP)
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    w = class_weights(train.y)
    Xtr, ytr = torch.tensor(train.X), torch.tensor(train.y)
    Xva, yva = torch.tensor(val.X), torch.tensor(val.y)
    best, best_state, best_epoch, bad = float("inf"), None, 0, 0
    for epoch in range(MAX_EPOCHS):
        model.train()
        order = rng.permutation(len(train))
        for i in range(0, len(order), BATCH):
            b = order[i:i + BATCH]
            loss = seq_loss(model(Xtr[b], ytr[b]), ytr[b], w)
            opt.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        model.eval()
        with torch.no_grad():
            vloss = seq_loss(model(Xva, yva), yva, w if SELECT == "weighted" else None).item()
        if verbose:
            print(f"  epoch {epoch:3d} val {vloss:.4f}")
        if vloss < best - 1e-4:
            best, best_epoch, bad = vloss, epoch, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            bad += 1
            if bad >= PATIENCE:
                break
    model.load_state_dict(best_state)
    model.eval()
    return model, best, best_epoch


def to_runtime(model: AttackWorldModel, mean: np.ndarray, std: np.ndarray, temperature: float = 1.0) -> WorldModelRuntime:
    weights = {k: v.astype(np.float64) for k, v in model.export_numpy().items()}
    manifest = {
        "feature_mean": mean.tolist(), "feature_std": std.tolist(),
        "history": D.HISTORY, "max_horizon": D.MAX_HORIZON, "temperature": temperature,
        "input_clip": INPUT_CLIP,
    }
    return WorldModelRuntime(weights, manifest)


def fit_temperature(rt: WorldModelRuntime, val: D.SequenceSet) -> tuple[float, dict]:
    """Single decoder temperature minimising validation NLL of the exact
    nowcast p(s_t) and one-step marginal p(s_{t+1}) (both deterministic)."""
    h = rt.encode(val.X)
    m1 = val.y[:, 1] >= 0
    nll = {}
    for T in np.round(np.arange(0.5, 3.01, 0.05), 2):
        p0, p1 = rt.next_state_exact(h, float(T))
        l0 = -np.log(np.clip(p0[np.arange(len(val)), val.y[:, 0]], 1e-6, 1))
        l1 = -np.log(np.clip(p1[m1][np.arange(m1.sum()), val.y[m1, 1]], 1e-6, 1))
        nll[float(T)] = float(np.concatenate([l0, l1]).mean())
    best = min(nll, key=nll.get)
    return best, nll


def ood_reference(windows, folds: list[int], mean: np.ndarray, std: np.ndarray) -> dict:
    """Quantiles of per-window max |z| over training windows (OOD reference)."""
    import pandas as pd  # noqa: F401  (windows is a DataFrame)
    z = np.abs((windows.loc[windows["fold"].isin(folds), FEATURE_NAMES].to_numpy(np.float64) - mean) / std).max(1)
    return {"statistic": "max_abs_z_of_window", "p99": float(np.quantile(z, 0.99)), "p999": float(np.quantile(z, 0.999)),
            "max": float(z.max())}


def export_artifact(out: Path, model: AttackWorldModel, manifest: dict) -> None:
    """Write weights.npz + manifest.json (with checksum) and verify they load."""
    out.mkdir(parents=True, exist_ok=True)
    weights_path = out / "weights.npz"
    np.savez(weights_path, **{k: v.astype(np.float32) for k, v in model.export_numpy().items()})
    manifest = {**manifest, "weights_sha256": hashlib.sha256(weights_path.read_bytes()).hexdigest()}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    WorldModelRuntime.load(out)


def attack_within(paths: np.ndarray, horizon: int) -> np.ndarray:
    """P(any attack state among s_{t+1..t+horizon}) from sampled paths (B, N, K+1)."""
    return (paths[:, :, 1:horizon + 1] != 0).any(axis=2).mean(axis=1)


def quiet_mask(y: np.ndarray, horizon: int) -> np.ndarray:
    """Samples whose current and next `horizon` windows are all NORMAL."""
    fut = y[:, :horizon + 1]
    return ((fut == 0) | (fut < 0)).all(axis=1) & (fut[:, horizon] >= 0)


def fit_warning_threshold(scores: np.ndarray, y: np.ndarray, horizon: int = WARNING_HORIZON) -> float:
    """Lowest threshold with false-alarm rate <= target on quiet validation samples."""
    quiet = quiet_mask(y, horizon)
    for cand in np.round(np.arange(0.02, 1.0, 0.01), 2):
        if (scores[quiet] >= cand).mean() <= TARGET_FALSE_ALARM_RATE:
            return float(cand)
    return 1.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="aegis-wm-1.0.0")
    ap.add_argument("--windows", default="data/processed/windows.parquet")
    args = ap.parse_args()
    torch.set_num_threads(4)

    windows = D.load_windows(args.windows)
    train_folds, val_fold, _ = D.fold_split(windows, None, D.PRODUCTION_VAL_FOLD)
    mean, std = D.standardiser(windows, train_folds)
    seqs = D.build_sequences(windows, mean, std)
    fold = windows["fold"].to_numpy()[seqs.idx]
    train, val = seqs.subset(np.isin(fold, train_folds)), seqs.subset(fold == val_fold)
    print(f"train={len(train)} val={len(val)} states(train)={np.bincount(train.y[:, 0], minlength=NUM_STATES).tolist()}")

    results = []
    for seed in range(N_SEEDS):
        t0 = time.time()
        model, vloss, epoch = train_world_model(seed, train, val)
        results.append((vloss, seed, epoch, model))
        print(f"seed {seed}: best val loss {vloss:.4f} @ epoch {epoch} ({time.time() - t0:.0f}s)")
    vloss, seed, epoch, model = min(results, key=lambda r: r[0])
    print(f"selected seed {seed}")

    rt = to_runtime(model, mean, std)
    T, nll_curve = fit_temperature(rt, val)
    rt.manifest["temperature"] = T
    r = rt.rollout(val.X, WARNING_HORIZON, MC_SAMPLES_FIT, seed=321)
    thr = fit_warning_threshold(attack_within(r.paths, WARNING_HORIZON), val.y)

    meta = json.loads((ROOT / "data" / "processed" / "windows_meta.json").read_text())
    manifest = {
        "model_version": args.version,
        "model_type": "GRU latent world model (autoregressive attack-state transition model)",
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "dataset": meta["dataset"],
        "dataset_sha256": meta["raw_file_sha256"],
        "window_seconds": meta["window_seconds"],
        "internal_networks": meta["internal_networks"],
        "min_attack_flows": meta["min_attack_flows"],
        "history": D.HISTORY,
        "max_horizon": D.MAX_HORIZON,
        "input_clip": INPUT_CLIP,
        "features": FEATURE_NAMES,
        "states": STATE_NAMES,
        "attack_states": [STATE_NAMES[i] for i in ATTACK_STATES],
        "feature_mean": mean.astype(float).tolist(),
        "feature_std": std.astype(float).tolist(),
        "ood_reference": ood_reference(windows, train_folds, mean, std),
        "hyperparameters": {
            "hidden": HIDDEN, "state_embedding": STATE_EMB, "dropout": DROPOUT, "lr": LR,
            "weight_decay": WEIGHT_DECAY, "batch": BATCH, "max_epochs": MAX_EPOCHS, "patience": PATIENCE,
            "early_stopping": SELECT, "input_clip": INPUT_CLIP,
            "block_minutes": D.BLOCK_MINUTES, "n_folds": D.N_FOLDS, "val_fold": val_fold,
        },
        "training": {
            "seeds": [{"seed": s, "val_loss": round(v, 5), "best_epoch": e} for v, s, e, _ in results],
            "selected_seed": seed,
            "train_folds": train_folds,
            "n_train": len(train), "n_val": len(val),
            "parameters": int(sum(v.size for v in model.export_numpy().values())),
        },
        "temperature": T,
        "calibration": {
            "method": "single decoder temperature; grid search on validation NLL of exact p(s_t) and p(s_t+1)",
            "val_nll_T1": round(nll_curve[1.0], 5), "val_nll_best": round(nll_curve[T], 5),
        },
        "early_warning": {
            "horizon": WARNING_HORIZON, "threshold": thr,
            "target_false_alarm_rate": TARGET_FALSE_ALARM_RATE,
            "definition": "warn when P(any attack state within the next `horizon` minutes) >= threshold",
        },
    }
    out = ROOT / "models" / args.version
    export_artifact(out, model, manifest)
    print(f"temperature={T} warning threshold={thr}; artifact written to {out}")


if __name__ == "__main__":
    main()
