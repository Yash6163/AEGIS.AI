"""Multi-dataset experiments with the PORTABLE feature set.

Datasets in cross-validation: CIC-IDS2017, UNSW-NB15, CTU-13 (each split into
5 folds of 30-minute blocks, stratified within the dataset, no shared minute).
Held-out case studies: DARPA 2000 LLDOS 1.0 (PCAP) and, if prepared,
CSE-CIC-IDS2018 (20 Feb).

E1 single   world model trained on one dataset, tested on its own test fold
E2 joint    one world model trained on the training folds of ALL datasets,
            tested per dataset  -> does pooling datasets help?
E3 lodo     leave-one-dataset-out: train on the other datasets (all folds),
            test on the unseen dataset -> zero-shot transfer / edge cases
E4 cases    joint model (all folds, all CV datasets) applied to DARPA 2000 and
            CIC-IDS2018: kill-chain lead time, early-warning quality
Baseline    XGBoost direct per horizon + binary early-warning XGBoost, trained
            the same way as the world model in E1 and E2.

Same protocol for every model: early stopping / temperature / warning
threshold (max validation F0.5) on the validation fold only. One seed per
model here (ensembles are used for the shipped model only).

Usage: python ml/evaluate_multi.py   -> models/<version>/metrics_multi.json
"""

from __future__ import annotations

from xgboost import XGBClassifier  # noqa: F401  # isort: skip  (import before torch)

import argparse
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import average_precision_score, f1_score, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "ml")]

import data as D  # noqa: E402
import evaluate as EV  # noqa: E402
import train as TR  # noqa: E402

from aegis.forecasting.features import PORTABLE_FEATURE_NAMES as PF  # noqa: E402
from aegis.forecasting.states import NUM_STATES, STATE_NAMES  # noqa: E402

CV_SETS = ["cic2017", "unsw", "ctu13"]
H = TR.WARNING_HORIZON


def load(path=ROOT / "data" / "processed" / "windows_multi.parquet") -> pd.DataFrame:
    w = pd.read_parquet(path).sort_values(["dataset", "day", "entity", "window_start"], kind="stable")
    parts = []
    for name, g in w.groupby("dataset", sort=False):
        g = D.assign_folds(g.reset_index(drop=True)) if name in CV_SETS else g.assign(fold=-1, pos=0, block=0)
        g["block"] = g["dataset"] + ":" + g["block"].astype(str)
        parts.append(g)
    return pd.concat(parts, ignore_index=True).reset_index(drop=True)


def seqs_for(w: pd.DataFrame, mean, std) -> D.SequenceSet:
    return D.build_sequences(w, mean, std, features=PF)


def fbeta(p, r, b=0.5):
    return 0.0 if p + r == 0 else (1 + b * b) * p * r / (b * b * p + r)


def ew_metrics(score, y, thr) -> dict:
    valid, target = TR.warning_target(y, H)
    s, t = score[valid], target[valid]
    out = {"n": int(valid.sum()), "positives": int(t.sum())}
    if 0 < t.sum() < len(t):
        out["auroc"] = float(roc_auc_score(t, s))
        out["auprc"] = float(average_precision_score(t, s))
    warn = s >= thr
    tp = float((warn & t).sum())
    p = tp / warn.sum() if warn.sum() else 0.0
    r = tp / t.sum() if t.sum() else 0.0
    out.update({"precision": p, "recall": r, "f05": fbeta(p, r), "f1": fbeta(p, r, 1),
                "false_alarm_rate": float((warn & ~t).sum() / max((~t).sum(), 1)), "threshold": float(thr)})
    return out


def state_metrics(probs: dict[int, np.ndarray], y: np.ndarray) -> dict:
    out = {}
    for k, p in probs.items():
        m = y[:, k] >= 0
        yt, pr = y[m, k], p[m].argmax(1)
        out[str(k)] = {"macro_f1": float(f1_score(yt, pr, labels=sorted(set(yt.tolist())), average="macro", zero_division=0)),
                       "accuracy": float((yt == pr).mean())}
    return out


def fit_world(tr, va, mean, std, seed):
    model, _, _ = TR.train_world_model(seed, tr, va)
    rt = TR.to_runtime(model, mean, std)
    rt.manifest["temperature"], _ = TR.fit_temperature(rt, va)
    thr = TR.fit_warning_threshold(rt.attack_within_exact(rt.encode(va.X), H), va.y)
    return rt, thr, model


def predict_world(rt, te):
    h = rt.encode(te.X)
    r = rt.rollout(te.X, H, 128, seed=11, h0=h)
    return {1: r.marginals[:, 1], H: r.marginals[:, H]}, rt.attack_within_exact(h, H)


def fit_xgb(tr, va, seed):
    Ftr, Fva = EV.flat(tr.X), EV.flat(va.X)
    models = {}
    for k in (1, H):
        m = tr.y[:, k] >= 0
        models[k] = EV.fit_direct("xgb", Ftr[m], tr.y[m, k], seed)
    valid, target = TR.warning_target(tr.y, H)
    binm = EV.fit_direct("xgb", Ftr[valid], target[valid].astype(int), seed)
    thr = TR.fit_warning_threshold(EV.predict_direct(binm, Fva)[:, 1], va.y)
    return models, binm, thr


def predict_xgb(models, binm, te):
    F = EV.flat(te.X)
    return {k: EV.predict_direct(m, F) for k, m in models.items()}, EV.predict_direct(binm, F)[:, 1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="aegis-wm-1.1.0")
    args = ap.parse_args()
    torch.set_num_threads(4)
    t_all = time.time()
    w = load()
    ds = w["dataset"].to_numpy()
    fold = w["fold"].to_numpy()
    results = {"E1_single": {}, "E2_joint": {}, "E3_lodo": {}, "E4_cases": {}}
    pooled: dict = {}

    def collect(exp, name, y, probs, score, thr):
        pooled.setdefault((exp, name), {"y": [], "p1": [], "p5": [], "s": [], "thr": []})
        d = pooled[(exp, name)]
        d["y"].append(y), d["p1"].append(probs[1]), d["p5"].append(probs[H]), d["s"].append(score)
        d["thr"].append(np.full(len(y), thr))

    for f in range(D.N_FOLDS):
        t0 = time.time()
        vf = (f + 1) % D.N_FOLDS
        trm, vam, tem = ~np.isin(fold, [f, vf]) & (fold >= 0), fold == vf, fold == f
        # E2 joint model: one standardiser for all datasets (fitted on training folds)
        mean, std = D.standardiser(w[trm], list(range(D.N_FOLDS)), PF)
        allseq = seqs_for(w, mean, std)
        sfold, sds = fold[allseq.idx], ds[allseq.idx]
        tr = allseq.subset(np.isin(sfold, [x for x in range(D.N_FOLDS) if x not in (f, vf)]) & np.isin(sds, CV_SETS))
        va = allseq.subset((sfold == vf) & np.isin(sds, CV_SETS))
        rt, thr, _ = fit_world(tr, va, mean, std, seed=f)
        xm, xb, xthr = fit_xgb(tr, va, seed=f)
        for name in CV_SETS:
            te = allseq.subset((sfold == f) & (sds == name))
            probs, score = predict_world(rt, te)
            collect("E2_joint", name, te.y, probs, score, thr)
            xp, xs = predict_xgb(xm, xb, te)
            collect("E2_xgb_joint", name, te.y, xp, xs, xthr)
        # E1 single-dataset models
        for name in CV_SETS:
            wd = w[ds == name]
            fd = wd["fold"].to_numpy()
            mean1, std1 = D.standardiser(wd[~np.isin(fd, [f, vf])], list(range(D.N_FOLDS)), PF)
            s1 = seqs_for(wd.reset_index(drop=True), mean1, std1)
            f1 = fd[s1.idx]
            tr1, va1, te1 = s1.subset(~np.isin(f1, [f, vf])), s1.subset(f1 == vf), s1.subset(f1 == f)
            rt1, thr1, _ = fit_world(tr1, va1, mean1, std1, seed=100 + f)
            probs, score = predict_world(rt1, te1)
            collect("E1_single", name, te1.y, probs, score, thr1)
            xm1, xb1, xthr1 = fit_xgb(tr1, va1, seed=f)
            xp, xs = predict_xgb(xm1, xb1, te1)
            collect("E1_xgb_single", name, te1.y, xp, xs, xthr1)
        print(f"fold {f} done ({time.time() - t0:.0f}s)", flush=True)

    for (exp, name), d in pooled.items():
        y = np.concatenate(d["y"])
        probs = {1: np.concatenate(d["p1"]), H: np.concatenate(d["p5"])}
        s, thr = np.concatenate(d["s"]), np.concatenate(d["thr"])
        m = state_metrics(probs, y)
        e = ew_metrics(s, y, 0.0)  # threshold-free parts
        valid, target = TR.warning_target(y, H)
        warn = (s >= thr)[valid]
        t = target[valid]
        tp = float((warn & t).sum())
        p_, r_ = (tp / warn.sum() if warn.sum() else 0.0), (tp / t.sum() if t.sum() else 0.0)
        e.update({"precision": p_, "recall": r_, "f05": fbeta(p_, r_), "f1": fbeta(p_, r_, 1),
                  "false_alarm_rate": float((warn & ~t).sum() / max((~t).sum(), 1))})
        e.pop("threshold", None)
        results.setdefault(exp, {})[name] = {"states": m, "early_warning": e, "n_samples": int(len(y))}

    # ---------- E3 leave-one-dataset-out + E4 case studies (models trained on all folds)
    def train_on(names, seed):
        m = np.isin(ds, names)
        mean, std = D.standardiser(w[m], list(range(D.N_FOLDS)), PF)
        seq = seqs_for(w, mean, std)
        sd, sf = ds[seq.idx], fold[seq.idx]
        vfold = 0
        tr = seq.subset(np.isin(sd, names) & (sf != vfold))
        va = seq.subset(np.isin(sd, names) & (sf == vfold))
        rt, thr, model = fit_world(tr, va, mean, std, seed)
        return rt, thr, seq, model, mean, std

    for held in CV_SETS:
        others = [n for n in CV_SETS if n != held]
        rt, thr, seq, _, _, _ = train_on(others, seed=7)
        te = seq.subset(ds[seq.idx] == held)
        probs, score = predict_world(rt, te)
        results["E3_lodo"][held] = {"trained_on": others, "states": state_metrics(probs, te.y),
                                    "early_warning": ew_metrics(score, te.y, thr), "n_samples": int(len(te))}
        print(f"LODO {held} done", flush=True)

    rt, thr, seq, model, mean, std = train_on(CV_SETS, seed=11)
    for case in sorted(set(ds) - set(CV_SETS)):
        te = seq.subset(ds[seq.idx] == case)
        probs, score = predict_world(rt, te)
        results["E4_cases"][case] = {"model": "joint portable world model (CIC-IDS2017 + UNSW-NB15 + CTU-13)",
                                     "states": state_metrics(probs, te.y), "early_warning": ew_metrics(score, te.y, thr),
                                     "n_samples": int(len(te)),
                                     "lead_time": lead_times(w, seq, te, score, thr)}
    results["protocol"] = {
        "features": "portable (26)", "feature_names": PF, "cv_datasets": CV_SETS, "folds": D.N_FOLDS,
        "block_minutes": D.BLOCK_MINUTES, "seeds": "one per model", "warning_horizon": H,
        "threshold": "max F0.5 on the validation fold", "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "runtime_seconds": round(time.time() - t_all),
        "support": {n: {STATE_NAMES[k]: int(v) for k, v in w.loc[ds == n, "state"].value_counts().sort_index().items()}
                    for n in sorted(set(ds))},
    }
    out = ROOT / "models" / args.version / "metrics_multi.json"
    out.write_text(json.dumps(results, indent=1))
    # keep the joint model trained on all CV datasets for serving non-CIC formats
    TR.export_artifact(ROOT / "models" / "aegis-portable-1.0.0", model, {
        "model_version": "aegis-portable-1.0.0",
        "model_type": "GRU latent world model on portable flow features (multi-dataset)",
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "datasets": CV_SETS, "features": PF, "states": STATE_NAMES, "feature_set": "portable",
        "feature_mean": mean.astype(float).tolist(), "feature_std": std.astype(float).tolist(),
        "history": D.HISTORY, "max_horizon": D.MAX_HORIZON, "input_clip": TR.INPUT_CLIP,
        "temperature": rt.manifest["temperature"], "window_seconds": 60,
        "early_warning": {"horizon": H, "threshold": thr, "selection": "max validation F0.5"},
        "ood_reference": {
            "statistic": "max_abs_z_of_window",
            "p999": float(np.quantile(np.abs((w.loc[np.isin(ds, CV_SETS), PF].to_numpy(float) - mean) / std).max(1), 0.999)),
        },
    })
    print(json.dumps({k: v for k, v in results.items() if k != "protocol"}, indent=0)[:6000])


def lead_times(w, seq, te, score, thr) -> dict:
    """Per onset (NORMAL -> attack) on each host: minutes of continuous warning before onset (max 5)."""
    st = w["state"].to_numpy()
    host = (w["day"] + "|" + w["entity"]).to_numpy()
    pos = {int(i): j for j, i in enumerate(te.idx)}
    events = []
    for j, t0 in enumerate(te.idx):
        if st[t0] == 0 or t0 == 0 or st[t0 - 1] != 0 or host[t0 - 1] != host[t0]:
            continue
        lead = 0
        for d in range(1, 6):
            jj = pos.get(t0 - d)
            if jj is None or host[t0 - d] != host[t0] or score[jj] < thr:
                break
            lead = d
        events.append({"host": w["entity"].iloc[t0], "state": STATE_NAMES[st[t0]], "minute": str(w["window_start"].iloc[t0]),
                       "lead_minutes": lead})
    leads = np.array([e["lead_minutes"] for e in events]) if events else np.array([])
    return {"n_onsets": len(events), "warned_before_onset_rate": float((leads > 0).mean()) if len(leads) else None,
            "events": events[:60]}


if __name__ == "__main__":
    main()
