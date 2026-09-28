"""Stage 3: 5-fold blocked cross-validation of the forecasting procedure + baselines.

For every fold f: train on the training folds, early-stop/calibrate on the
validation fold, predict the test fold. Out-of-fold (OOF) predictions of all
folds are pooled, so every sample is scored exactly once by a model that never
saw its time block. Nothing here is hand-entered: every number written to
metrics.json is computed from these predictions.

Models compared (probabilistic forecasts of s_{t+k}, k in HORIZONS):
  world_model        GRU latent world model, Monte-Carlo rollout (ours)
  markov_nowcast     first-order Markov chain T^k applied to the world model's
                     nowcast distribution p(s_t | x)
  markov_oracle      T^k applied to the TRUE current state (not available in
                     deployment; an upper reference for "state persistence")
  persistence_oracle s_{t+k} = true s_t (not deployable; reference)
  xgboost_direct     one XGBoost classifier per horizon on the flattened
                     history window (direct multi-horizon)
  random_forest      one Random Forest per horizon, same inputs
  majority           always NORMAL

Usage: python ml/evaluate.py [--version aegis-wm-1.0.0] [--fast]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# xgboost must be imported before torch: on macOS the two bundle different
# OpenMP runtimes and the reverse order segfaults.
from xgboost import XGBClassifier  # isort: skip

import numpy as np
import torch
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import average_precision_score, confusion_matrix, f1_score, precision_recall_fscore_support, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "ml"))

import data as D  # noqa: E402
import train as TR  # noqa: E402

from aegis.forecasting.features import FEATURE_NAMES  # noqa: E402
from aegis.forecasting.states import COMPROMISE_STATES, NUM_STATES, STATE_NAMES  # noqa: E402

HORIZONS = [0, 1, 3, 5, 10]
MC_SAMPLES = 256
EW_H = TR.WARNING_HORIZON
LEAD_LOOKBACK = 5


# ----------------------------------------------------------------- metrics
def ece(probs: np.ndarray, y: np.ndarray, bins: int = 15) -> tuple[float, list[dict]]:
    conf = probs.max(1)
    pred = probs.argmax(1)
    edges = np.linspace(0, 1, bins + 1)
    out, total = [], 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.sum() == 0:
            continue
        acc, c = float((pred[m] == y[m]).mean()), float(conf[m].mean())
        total += m.mean() * abs(acc - c)
        out.append({"lo": round(lo, 3), "hi": round(hi, 3), "n": int(m.sum()), "accuracy": round(acc, 4), "confidence": round(c, 4)})
    return float(total), out


def prob_metrics(probs: np.ndarray, y: np.ndarray, y_now: np.ndarray) -> dict:
    pred = probs.argmax(1)
    labels = sorted(set(y.tolist()))
    onehot = np.eye(NUM_STATES)[y]
    changed = y != y_now
    top3 = np.argsort(-probs, axis=1)[:, :3]
    attack_true, attack_pred = y != 0, pred != 0
    tp = int((attack_true & attack_pred).sum())
    res = {
        "n": int(len(y)),
        "accuracy": float((pred == y).mean()),
        "macro_f1": float(f1_score(y, pred, labels=labels, average="macro", zero_division=0)),
        "top3_accuracy": float((top3 == y[:, None]).any(1).mean()),
        "brier": float(((probs - onehot) ** 2).sum(1).mean()),
        "nll": float(-np.log(np.clip(probs[np.arange(len(y)), y], 1e-6, 1)).mean()),
        "ece": ece(probs, y)[0],
        "attack_precision": tp / max(int(attack_pred.sum()), 1),
        "attack_recall": tp / max(int(attack_true.sum()), 1),
        "n_state_changes": int(changed.sum()),
        "state_change_accuracy": float((pred[changed] == y[changed]).mean()) if changed.any() else None,
    }
    return res


def per_class(probs: np.ndarray, y: np.ndarray) -> dict:
    pred = probs.argmax(1)
    p, r, f, s = precision_recall_fscore_support(y, pred, labels=range(NUM_STATES), zero_division=0)
    return {
        "per_class": [
            {"state": STATE_NAMES[i], "precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "support": int(s[i])}
            for i in range(NUM_STATES)
        ],
        "confusion_matrix": confusion_matrix(y, pred, labels=range(NUM_STATES)).tolist(),
    }


def binary_metrics(score: np.ndarray, target: np.ndarray, thr: np.ndarray | float) -> dict:
    warn = score >= thr
    quiet = ~target
    return {
        "n": int(len(target)), "positives": int(target.sum()),
        "auroc": float(roc_auc_score(target, score)) if 0 < target.sum() < len(target) else None,
        "auprc": float(average_precision_score(target, score)) if target.any() else None,
        "recall_at_threshold": float(warn[target].mean()) if target.any() else None,
        "precision_at_threshold": float(target[warn].mean()) if warn.any() else None,
        "false_alarm_rate_at_threshold": float(warn[quiet].mean()) if quiet.any() else None,
    }


# ------------------------------------------------------------- baselines
def markov_matrix(windows, rows: np.ndarray, alpha: float = 0.1) -> np.ndarray:
    """Transition counts between consecutive minutes of the same host and block."""
    st = windows["state"].to_numpy()
    seg = (windows["block"].astype(str) + "|" + windows["entity"].astype(str)).to_numpy()
    rows = np.sort(rows)
    a, b = rows[:-1], rows[1:]
    ok = (b == a + 1) & (seg[a] == seg[b])
    C = np.full((NUM_STATES, NUM_STATES), alpha)
    np.add.at(C, (st[a[ok]], st[b[ok]]), 1)
    return C / C.sum(1, keepdims=True)


def markov_hit(p0: np.ndarray, T: np.ndarray, h: int) -> np.ndarray:
    v = p0 @ T  # distribution of s_{t+1}
    return 1 - v[:, 0] * T[0, 0] ** (h - 1)


def fit_direct(kind: str, X: np.ndarray, y: np.ndarray, seed: int):
    classes = np.unique(y)
    enc = np.searchsorted(classes, y)
    cnt = np.bincount(enc)
    sw = (len(enc) / cnt[enc]) ** 0.5
    if kind == "xgb":
        clf = XGBClassifier(n_estimators=250, max_depth=4, learning_rate=0.05, subsample=0.8,
                            colsample_bytree=0.5, tree_method="hist", n_jobs=8, random_state=seed)
        if len(classes) == 1:
            return classes, None
        clf.fit(X, enc, sample_weight=sw)
    else:
        clf = RandomForestClassifier(n_estimators=200, min_samples_leaf=2, class_weight="balanced_subsample",
                                     n_jobs=8, random_state=seed)
        clf.fit(X, enc)
    return classes, clf


def predict_direct(model, X: np.ndarray) -> np.ndarray:
    classes, clf = model
    out = np.zeros((len(X), NUM_STATES))
    if clf is None:
        out[:, classes[0]] = 1
        return out
    out[:, classes] = clf.predict_proba(X)
    return out


def flat(X: np.ndarray) -> np.ndarray:
    """Direct-model input: last 3 windows + mean/max over the full history."""
    return np.concatenate([X[:, -3:].reshape(len(X), -1), X.mean(1), X.max(1)], axis=1)


# ---------------------------------------------------------------- driver
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="aegis-wm-1.0.0")
    ap.add_argument("--fast", action="store_true", help="skip the random forest baseline")
    args = ap.parse_args()
    torch.set_num_threads(4)
    t_start = time.time()

    windows = D.load_windows()
    fold_of_row = windows["fold"].to_numpy()
    oof: dict[str, dict[int, list]] = {}
    ew: dict[str, list] = {"world_model": [], "markov_nowcast": [], "xgboost_direct": []}
    ew_thr: dict[str, list] = {k: [] for k in ew}
    Y, IDX, FOLD = [], [], []
    importance_rows, fold_summ, latency = [], [], []

    def put(name: str, k: int, probs: np.ndarray) -> None:
        oof.setdefault(name, {}).setdefault(k, []).append(probs)

    for f in range(D.N_FOLDS):
        t0 = time.time()
        train_folds, val_fold, test_fold = D.fold_split(windows, f, (f + 1) % D.N_FOLDS)
        mean, std = D.standardiser(windows, train_folds)
        seqs = D.build_sequences(windows, mean, std)
        fo = fold_of_row[seqs.idx]
        tr, va, te = (seqs.subset(np.isin(fo, fs)) for fs in (train_folds, [val_fold], [test_fold]))
        Y.append(te.y), IDX.append(te.idx), FOLD.append(np.full(len(te), f))

        # --- world model
        model, vloss, epoch = TR.train_world_model(seed=f, train=tr, val=va)
        rt = TR.to_runtime(model, mean, std)
        T, _ = TR.fit_temperature(rt, va)
        rt.manifest["temperature"] = T
        rv = rt.rollout(va.X, EW_H, TR.MC_SAMPLES_FIT, seed=321)
        thr = TR.fit_warning_threshold(TR.attack_within(rv.paths, EW_H), va.y)
        tt = time.perf_counter()
        r = rt.rollout(te.X, D.MAX_HORIZON, MC_SAMPLES, seed=7)
        latency.append((time.perf_counter() - tt) / len(te) * 1000)
        for k in range(D.MAX_HORIZON + 1):
            put("world_model", k, r.marginals[:, k])
        ew["world_model"].append(TR.attack_within(r.paths, EW_H))
        ew_thr["world_model"].append(np.full(len(te), thr))
        put("world_model_compromise", 0, (np.isin(r.paths[:, :, 1:EW_H + 1], COMPROMISE_STATES)).any(2).mean(1)[:, None])

        # --- Markov baselines (transition matrix from training folds only)
        Tm = markov_matrix(windows, np.where(np.isin(fold_of_row, train_folds))[0])
        now_true = np.eye(NUM_STATES)[te.y[:, 0]]
        for k in range(D.MAX_HORIZON + 1):
            Tk = np.linalg.matrix_power(Tm, k)
            put("markov_nowcast", k, r.nowcast @ Tk)
            put("markov_oracle", k, now_true @ Tk)
            put("persistence_oracle", k, now_true)
            put("majority", k, np.tile(np.eye(NUM_STATES)[0], (len(te), 1)))
        pv = rv.nowcast
        hit_v = markov_hit(pv, Tm, EW_H)
        ew["markov_nowcast"].append(markov_hit(r.nowcast, Tm, EW_H))
        ew_thr["markov_nowcast"].append(np.full(len(te), TR.fit_warning_threshold(hit_v, va.y)))

        # --- direct tree baselines, one model per horizon
        Ftr, Fva, Fte = flat(tr.X), flat(va.X), flat(te.X)
        for k in HORIZONS:
            m = tr.y[:, k] >= 0
            xm = fit_direct("xgb", Ftr[m], tr.y[m, k], f)
            put("xgboost_direct", k, predict_direct(xm, Fte))
            if not args.fast:
                rm = fit_direct("rf", Ftr[m], tr.y[m, k], f)
                put("random_forest", k, predict_direct(rm, Fte))
        # binary early-warning XGBoost: any attack in (t, t+EW_H]
        fut = tr.y[:, 1:EW_H + 1]
        m = fut[:, -1] >= 0
        target = (fut[m] > 0).any(1).astype(int)
        xb = fit_direct("xgb", Ftr[m], target, f)
        score_te = predict_direct(xb, Fte)[:, 1]
        score_va = predict_direct(xb, Fva)[:, 1]
        ew["xgboost_direct"].append(score_te)
        ew_thr["xgboost_direct"].append(np.full(len(te), TR.fit_warning_threshold(score_va, va.y)))

        # --- permutation importance (world model, exact next-state NLL)
        valid = te.y[:, 1] >= 0
        h = rt.encode(te.X[valid])
        base = -np.log(np.clip(rt.next_state_exact(h)[1][np.arange(valid.sum()), te.y[valid, 1]], 1e-6, 1)).mean()
        rng = np.random.default_rng(f)
        for j, name in enumerate(FEATURE_NAMES):
            Xp = te.X[valid].copy()
            Xp[:, :, j] = Xp[rng.permutation(len(Xp)), :, j]
            p1 = rt.next_state_exact(rt.encode(Xp))[1]
            importance_rows.append((f, name, float(-np.log(np.clip(p1[np.arange(len(Xp)), te.y[valid, 1]], 1e-6, 1)).mean() - base)))

        # keep the fold model: the demo replay uses it for the windows of its
        # test fold, so every replayed forecast is out-of-sample
        TR.export_artifact(ROOT / "models" / args.version / "cv" / f"fold{f}", model, {
            "model_version": f"{args.version}-cv-fold{f}", "test_fold": f, "val_fold": val_fold,
            "train_folds": train_folds, "feature_mean": mean.astype(float).tolist(),
            "feature_std": std.astype(float).tolist(), "history": D.HISTORY, "max_horizon": D.MAX_HORIZON,
            "temperature": T, "early_warning": {"horizon": EW_H, "threshold": thr},
            "ood_reference": TR.ood_reference(windows, train_folds, mean, std),
        })
        fold_summ.append({"fold": f, "n_train": len(tr), "n_val": len(va), "n_test": len(te), "val_loss": vloss,
                          "best_epoch": epoch, "temperature": T, "warning_threshold": thr,
                          "test_states": np.bincount(te.y[:, 0], minlength=NUM_STATES).tolist()})
        print(f"fold {f}: train={len(tr)} val={len(va)} test={len(te)} epoch={epoch} T={T} thr={thr} ({time.time() - t0:.0f}s)")

    y_all, idx_all, fold_all = np.concatenate(Y), np.concatenate(IDX), np.concatenate(FOLD)

    # --------------------------------------------------- forecast metrics
    per_fold_metric = {}
    results: dict[str, dict] = {}
    for name, by_k in oof.items():
        if name == "world_model_compromise":
            continue
        results[name] = {}
        for k in sorted(by_k):
            probs = np.concatenate(by_k[k])
            m = y_all[:, k] >= 0
            results[name][str(k)] = prob_metrics(probs[m], y_all[m, k], y_all[m, 0])
            if name == "world_model":
                per_fold_metric[str(k)] = [
                    float(f1_score(y_all[m & (fold_all == f), k], probs[m & (fold_all == f)].argmax(1), average="macro",
                                   labels=sorted(set(y_all[m & (fold_all == f), k].tolist())), zero_division=0))
                    for f in range(D.N_FOLDS)
                ]
    wm = {k: np.concatenate(v) for k, v in oof["world_model"].items()}
    detail = {}
    for k in (0, 1, 5):
        m = y_all[:, k] >= 0
        detail[str(k)] = per_class(wm[k][m], y_all[m, k])
        detail[str(k)]["reliability"] = ece(wm[k][m], y_all[m, k])[1]

    # --------------------------------------------------- early warning
    fut = y_all[:, 1:EW_H + 1]
    valid = fut[:, -1] >= 0
    target = (fut > 0).any(1)
    early = {}
    for name in ew:
        s, th = np.concatenate(ew[name]), np.concatenate(ew_thr[name])
        early[name] = binary_metrics(s[valid], target[valid], th[valid])
    comp_score = np.concatenate(oof["world_model_compromise"][0])[:, 0]
    comp_target = np.isin(fut, COMPROMISE_STATES).any(1)
    early["world_model_compromise_probability"] = {
        "auroc": float(roc_auc_score(comp_target[valid], comp_score[valid])) if comp_target[valid].any() else None,
        "auprc": float(average_precision_score(comp_target[valid], comp_score[valid])) if comp_target[valid].any() else None,
        "positives": int(comp_target[valid].sum()),
    }

    # --------------------------------------------------- lead time
    # onset: host attack state at t0 with NORMAL at t0-1, both within one block.
    score_wm, thr_wm = np.concatenate(ew["world_model"]), np.concatenate(ew_thr["world_model"])
    now_pred = wm[0].argmax(1)
    pos = {int(i): j for j, i in enumerate(idx_all)}
    st = windows["state"].to_numpy()
    seg = (windows["block"].astype(str) + "|" + windows["entity"].astype(str)).to_numpy()
    events = []
    for j, t0 in enumerate(idx_all):
        if st[t0] == 0 or st[t0 - 1] != 0 or seg[t0 - 1] != seg[t0]:
            continue
        prior = [t0 - d for d in range(1, LEAD_LOOKBACK + 1)]
        if any(t not in pos or seg[t] != seg[t0] for t in prior):
            continue  # not enough in-block history to evaluate a warning lead
        lead = 0
        for d in range(1, LEAD_LOOKBACK + 1):
            jj = pos[t0 - d]
            if score_wm[jj] >= thr_wm[jj]:
                lead = d
            else:
                break
        hist = st[max(t0 - D.HISTORY, 0):t0][seg[max(t0 - D.HISTORY, 0):t0] == seg[t0]]
        events.append({
            "state": STATE_NAMES[st[t0]], "lead_minutes": lead,
            "any_warning_before_onset": any(score_wm[pos[t]] >= thr_wm[pos[t]] for t in prior),
            "detected_at_onset": bool(now_pred[j] != 0),
            "prior_attack_in_history": bool((hist > 0).any()),
        })

    def lead_summary(ev):
        if not ev:
            return {"n_onsets": 0}
        leads = np.array([e["lead_minutes"] for e in ev])
        return {
            "n_onsets": len(ev),
            "forecast_before_onset_rate": float((leads > 0).mean()),
            "mean_lead_minutes": float(leads.mean()),
            "median_lead_minutes_when_forecast": float(np.median(leads[leads > 0])) if (leads > 0).any() else 0.0,
            "detected_at_onset_rate": float(np.mean([e["detected_at_onset"] for e in ev])),
        }

    quiet = TR.quiet_mask(y_all, EW_H)
    warn_quiet = (score_wm >= thr_wm)[quiet]
    lead = {
        "definition": ("onset = host enters an attack state at t0 after a NORMAL minute; lead = number of consecutive "
                       f"minutes before t0 (max {LEAD_LOOKBACK}) at which P(attack within {EW_H} min) >= validation-chosen "
                       "threshold. 'Conventional detection' = nowcast head flags the onset minute itself (lead 0)."),
        "all": lead_summary(events),
        "campaign_reonset": lead_summary([e for e in events if e["prior_attack_in_history"]]),
        "cold_onset": lead_summary([e for e in events if not e["prior_attack_in_history"]]),
        "by_state": {s: lead_summary([e for e in events if e["state"] == s]) for s in sorted({e["state"] for e in events})},
        "false_warnings_per_host_hour": float(warn_quiet.mean() * 60),
        "quiet_samples": int(quiet.sum()),
    }

    imp = {}
    for _, name, v in importance_rows:
        imp.setdefault(name, []).append(v)
    importance = sorted(({"feature": k, "mean_nll_increase": float(np.mean(v)), "std": float(np.std(v))} for k, v in imp.items()),
                        key=lambda d: -d["mean_nll_increase"])

    metrics = {
        "model_version": args.version,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "protocol": {
            "type": f"{D.N_FOLDS}-fold blocked cross-validation, out-of-fold predictions pooled",
            "block_minutes": D.BLOCK_MINUTES, "history": D.HISTORY, "max_horizon": D.MAX_HORIZON,
            "mc_samples": MC_SAMPLES, "unit": "one sample = one internal host at one minute",
            "n_samples": int(len(y_all)),
            "state_support_current": {STATE_NAMES[i]: int(c) for i, c in enumerate(np.bincount(y_all[:, 0], minlength=NUM_STATES))},
        },
        "horizons": HORIZONS,
        "forecast": results,
        "world_model_macro_f1_per_fold": per_fold_metric,
        "world_model_detail": detail,
        "early_warning": {"horizon": EW_H, "models": early},
        "lead_time": lead,
        "permutation_importance": {"target": "NLL of next-minute state (exact marginal)", "features": importance},
        "folds": fold_summ,
        "inference_latency_ms_per_host": {"mean": float(np.mean(latency)), "mc_samples": MC_SAMPLES, "horizon": D.MAX_HORIZON},
        "runtime_seconds": round(time.time() - t_start, 1),
    }
    out = ROOT / "models" / args.version
    out.mkdir(parents=True, exist_ok=True)
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print_summary(metrics)


def print_summary(m: dict) -> None:
    print("\nmodel               " + "".join(f"  k={k:<2d} acc  mF1  " for k in m["horizons"]))
    for name, by_k in m["forecast"].items():
        row = "".join(f"  {by_k[str(k)]['accuracy']:.3f} {by_k[str(k)]['macro_f1']:.3f}" if str(k) in by_k else " " * 14
                      for k in m["horizons"])
        print(f"{name:20s}{row}")
    print("\nearly warning:", json.dumps(m["early_warning"]["models"], indent=1))
    print("lead time:", json.dumps({k: v for k, v in m["lead_time"].items() if k != "definition"}, indent=1))
    print("top features:", [f["feature"] for f in m["permutation_importance"]["features"][:8]])


if __name__ == "__main__":
    main()
