"""Zero-shot transfer of the SHIPPED models to held-out captures.

  portable  aegis-portable-1.0.0 (trained on CIC-IDS2017 + UNSW-NB15 + CTU-13)
  cic       aegis-wm-1.1.0       (trained on CIC-IDS2017 only, 37 features)

Targets (never used for training or model selection):
  darpa2000  DARPA 2000 LLDOS 1.0, flows built from PCAP by aegis.ingestion.pcap
  cic2018    CSE-CIC-IDS2018 20-Feb-2018 (DDoS day; the only day that keeps IPs)

Each model uses its own validated warning threshold. Results are merged into
models/aegis-wm-1.1.0/metrics_multi.json under "E5_transfer".
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import recall_score

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "ml")]

import data as D  # noqa: E402
import evaluate_multi as EM  # noqa: E402

from aegis.forecasting.features import FEATURE_NAMES, PORTABLE_FEATURE_NAMES  # noqa: E402
from aegis.forecasting.runtime import load_runtime  # noqa: E402
from aegis.forecasting.states import STATE_NAMES  # noqa: E402

H = 5


def run(rt, windows: pd.DataFrame, features: list[str], thr: float, self_calibrate: bool = False) -> dict:
    """self_calibrate: standardise with the TARGET network's own feature statistics
    (unsupervised - no labels; what a deployment computes from its first hours of traffic)."""
    w = windows.sort_values(["day", "entity", "window_start"], kind="stable").reset_index(drop=True)
    w = w.assign(block=w["day"], fold=0)
    if self_calibrate:
        vals = w[features].to_numpy(np.float64)
        mean, std = vals.mean(0), vals.std(0)
        std[std < 1e-6] = 1.0
        # runtime.encode re-standardises with its own stats, so pass pre-mapped values
        w[features] = (vals - mean) / std * rt.std + rt.mean
    seq = D.build_sequences(w, rt.mean.astype(np.float32), rt.std.astype(np.float32), features=features)
    h = rt.encode(seq.X)
    score = rt.attack_within_exact(h, H)
    now = rt.next_state_exact(h)[0].argmax(1)
    out = {"n_samples": int(len(seq)), "early_warning": EM.ew_metrics(score, seq.y, thr),
           "lead_time": EM.lead_times(w, seq, seq, score, thr)}
    y0 = seq.y[:, 0]
    attack = y0 > 0
    out["nowcast_attack_recall"] = float((now[attack] > 0).mean()) if attack.any() else None
    out["nowcast_per_state_recall"] = {
        STATE_NAMES[s]: float(recall_score(y0 == s, now == s, zero_division=0)) for s in sorted(set(y0.tolist())) if s > 0}
    out["support"] = {STATE_NAMES[k]: int(v) for k, v in pd.Series(y0).value_counts().sort_index().items()}
    return out


def main() -> None:
    port = load_runtime(ROOT / "models" / "aegis-portable-1.0.0")
    cic = load_runtime(ROOT / "models" / "aegis-wm-1.1.0")
    wp = pd.read_parquet(ROOT / "data" / "processed" / "windows_multi.parquet")
    wc = pd.read_parquet(ROOT / "data" / "processed" / "windows_cicfull_ext.parquet")
    res = {}
    for target in sorted(set(wp["dataset"]) & {"darpa2000", "cic2018"}):
        pt, ct = port.manifest["early_warning"]["threshold"], cic.manifest["early_warning"]["threshold"]
        res[target] = {
            "portable_model": run(port, wp[wp["dataset"] == target], PORTABLE_FEATURE_NAMES, pt),
            "portable_model_self_calibrated": run(port, wp[wp["dataset"] == target], PORTABLE_FEATURE_NAMES, pt, True),
        }
        if target in set(wc["dataset"]):
            res[target]["cic_model"] = run(cic, wc[wc["dataset"] == target], FEATURE_NAMES, ct)
            res[target]["cic_model_self_calibrated"] = run(cic, wc[wc["dataset"] == target], FEATURE_NAMES, ct, True)
        for k, v in res[target].items():
            e = v["early_warning"]
            print(f"{target:10s} {k:32s} AUROC={e.get('auroc', float('nan')):.3f} AUPRC={e.get('auprc', float('nan')):.3f} "
                  f"P={e['precision']:.2f} R={e['recall']:.2f} F0.5={e['f05']:.3f} onsets={v['lead_time']['n_onsets']} "
                  f"warned={v['lead_time']['warned_before_onset_rate']} nowcast-recall={v['nowcast_attack_recall']}")
    path = ROOT / "models" / "aegis-wm-1.1.0" / "metrics_multi.json"
    m = json.loads(path.read_text())
    m["E5_transfer"] = res
    path.write_text(json.dumps(m, indent=1))


if __name__ == "__main__":
    main()
