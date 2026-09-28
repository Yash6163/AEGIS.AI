"""Stage 2: train the production attack-state world model and export it.

  * training folds = all except PRODUCTION_VAL_FOLD, which is used for early
    stopping, temperature calibration and the early-warning threshold
  * N_MEMBERS seeds, all kept as an equal-weight ensemble (no seed picking);
    generalisation is estimated separately by evaluate.py with 5-fold blocked
    cross-validation of this same procedure
  * exports models/<version>/{weights.npz, manifest.json}

Usage: python ml/train.py [--version aegis-wm-1.1.0]
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
from aegis.forecasting.runtime import EnsembleRuntime, WorldModelRuntime, load_runtime  # noqa: E402
from aegis.forecasting.states import ATTACK_STATES, NUM_STATES, STATE_NAMES  # noqa: E402

N_MEMBERS = 5  # ensemble size: seeds 0..N_MEMBERS-1, all kept (no seed picking)
# Selected by ml/tune.py on validation folds (see models/<version>/tuning.json)
HIDDEN, STATE_EMB, DROPOUT = 64, 16, 0.4
LR, WEIGHT_DECAY, BATCH, MAX_EPOCHS, PATIENCE = 1e-3, 1e-3, 128, 120, 15
SELECT = "unweighted"  # early-stopping criterion: class-weighted or plain validation NLL
CLASS_WEIGHT_POWER = 0.0  # round-2 tuning: plain maximum likelihood won on every validation metric
INPUT_CLIP = 0.0  # >0: clip standardised features to [-c, c] (model and runtime)
WARNING_HORIZON = 5
THRESHOLD_BETA = 0.5  # warning threshold maximises validation F-beta (0.5 = precision-weighted)
MC_SAMPLES_FIT = 256


def class_weights(y: np.ndarray) -> torch.Tensor:
    """(inverse frequency) ** CLASS_WEIGHT_POWER over states present in training.

    0 = plain maximum likelihood (calibrated priors, highest precision),
    0.5 = square-root re-weighting (more recall on rare attack states)."""
    counts = np.bincount(y[y >= 0], minlength=NUM_STATES).astype(np.float64)
    w = np.where(counts > 0, (counts.sum() / np.maximum(counts, 1)) ** CLASS_WEIGHT_POWER, 0.0)
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


def train_members(train: D.SequenceSet, val: D.SequenceSet, seeds, log=print) -> list[tuple]:
    """Train one model per seed; returns [(model, val_loss, best_epoch, seed)]."""
    out = []
    for seed in seeds:
        t0 = time.time()
        model, vloss, epoch = train_world_model(seed, train, val)
        out.append((model, vloss, epoch, seed))
        if log:
            log(f"  member seed {seed}: val loss {vloss:.4f} @ epoch {epoch} ({time.time() - t0:.0f}s)")
    return out


def to_runtime(models, mean: np.ndarray, std: np.ndarray, temperature: float = 1.0):
    """Runtime for one model or an equal-weight ensemble of models."""
    models = models if isinstance(models, list | tuple) else [models]
    manifest = {
        "feature_mean": mean.tolist(), "feature_std": std.tolist(),
        "history": D.HISTORY, "max_horizon": D.MAX_HORIZON, "temperature": temperature,
        "input_clip": INPUT_CLIP, "members": len(models),
    }
    members = [WorldModelRuntime({k: v.astype(np.float64) for k, v in m.export_numpy().items()}, manifest) for m in models]
    return members[0] if len(members) == 1 else EnsembleRuntime(members, manifest)


def fit_temperature(rt, val: D.SequenceSet) -> tuple[float, dict]:
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


def export_artifact(out: Path, models, manifest: dict) -> None:
    """Write weights.npz (+ member prefixes for ensembles) and manifest.json
    with checksum, then verify the artifact loads."""
    models = models if isinstance(models, list | tuple) else [models]
    out.mkdir(parents=True, exist_ok=True)
    weights_path = out / "weights.npz"
    if len(models) == 1:
        arrays = {k: v.astype(np.float32) for k, v in models[0].export_numpy().items()}
    else:
        arrays = {f"m{i}__{k}": v.astype(np.float32) for i, m in enumerate(models) for k, v in m.export_numpy().items()}
    np.savez(weights_path, **arrays)
    manifest = {**manifest, "members": len(models), "weights_sha256": hashlib.sha256(weights_path.read_bytes()).hexdigest()}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    load_runtime(out)


def attack_within(paths: np.ndarray, horizon: int) -> np.ndarray:
    """P(any attack state among s_{t+1..t+horizon}) from sampled paths (B, N, K+1)."""
    return (paths[:, :, 1:horizon + 1] != 0).any(axis=2).mean(axis=1)


def quiet_mask(y: np.ndarray, horizon: int) -> np.ndarray:
    """Samples whose current and next `horizon` windows are all NORMAL."""
    fut = y[:, :horizon + 1]
    return ((fut == 0) | (fut < 0)).all(axis=1) & (fut[:, horizon] >= 0)


def warning_target(y: np.ndarray, horizon: int = WARNING_HORIZON) -> tuple[np.ndarray, np.ndarray]:
    """(valid mask, target): target = any attack state among s_{t+1..t+horizon}."""
    fut = y[:, 1:horizon + 1]
    valid = fut[:, -1] >= 0
    return valid, (fut > 0).any(axis=1)


def fit_warning_threshold(scores: np.ndarray, y: np.ndarray, horizon: int = WARNING_HORIZON,
                          beta: float = THRESHOLD_BETA) -> float:
    """Threshold maximising F-beta of the early-warning decision on validation.

    beta = 0.5 weights precision twice as much as recall (fewer false alarms);
    ties go to the higher threshold."""
    valid, target = warning_target(y, horizon)
    s, t = scores[valid], target[valid]
    best, best_f = 1.0, -1.0
    for cand in np.round(np.arange(0.02, 1.0, 0.01), 2):
        warn = s >= cand
        tp = float((warn & t).sum())
        if tp == 0:
            continue
        p, r = tp / warn.sum(), tp / t.sum()
        f = (1 + beta**2) * p * r / (beta**2 * p + r)
        if f >= best_f:
            best, best_f = float(cand), f
    return best


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="aegis-wm-1.1.0")
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

    results = train_members(train, val, range(N_MEMBERS))
    models = [r[0] for r in results]
    rt = to_runtime(models, mean, std)
    T, nll_curve = fit_temperature(rt, val)
    rt.manifest["temperature"] = T
    thr = fit_warning_threshold(rt.attack_within_exact(rt.encode(val.X), WARNING_HORIZON), val.y)

    meta = json.loads((ROOT / "data" / "processed" / "windows_meta.json").read_text())
    manifest = {
        "model_version": args.version,
        "model_type": f"Ensemble of {N_MEMBERS} GRU latent world models (autoregressive attack-state transition model)",
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
            "early_stopping": SELECT, "input_clip": INPUT_CLIP, "class_weight_power": CLASS_WEIGHT_POWER,
            "block_minutes": D.BLOCK_MINUTES, "n_folds": D.N_FOLDS, "val_fold": val_fold,
        },
        "training": {
            "members": [{"seed": s, "val_loss": round(v, 5), "best_epoch": e} for _, v, e, s in results],
            "train_folds": train_folds,
            "n_train": len(train), "n_val": len(val),
            "parameters": int(sum(v.size for m in models for v in m.export_numpy().values())),
            "parameters_per_member": int(sum(v.size for v in models[0].export_numpy().values())),
        },
        "temperature": T,
        "calibration": {
            "method": "single decoder temperature; grid search on validation NLL of exact p(s_t) and p(s_t+1)",
            "val_nll_T1": round(nll_curve[1.0], 5), "val_nll_best": round(nll_curve[T], 5),
        },
        "early_warning": {
            "horizon": WARNING_HORIZON, "threshold": thr,
            "selection": f"threshold maximising validation F{THRESHOLD_BETA:g} of 'attack within horizon'",
            "definition": "warn when P(any attack state within the next `horizon` minutes) >= threshold",
        },
    }
    out = ROOT / "models" / args.version
    export_artifact(out, models, manifest)
    print(f"temperature={T} warning threshold={thr}; artifact written to {out}")


if __name__ == "__main__":
    main()
