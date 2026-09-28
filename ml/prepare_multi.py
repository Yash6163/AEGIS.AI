"""Multi-dataset preparation: raw -> per-host minute windows with PORTABLE features.

Output: data/processed/windows_multi.parquet
  columns: dataset, day (capture segment), entity, window_start, 26 portable
  features, state
Also writes data/processed/windows_cicfull_ext.parquet with the full 37 CIC
features for datasets that carry CICFlowMeter-equivalent fields (CIC-IDS2018,
DARPA-from-PCAP), used to test the production CIC-IDS2017 model zero-shot.

Usage: python ml/prepare_multi.py [--datasets cic2017 unsw ctu13 cic2018 darpa2000]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "ml")]

import datasets as DS  # noqa: E402

from aegis.forecasting.features import (  # noqa: E402
    FEATURE_NAMES,
    PORTABLE_FEATURE_NAMES,
    entity_flows,
    entity_window_features,
    parse_networks,
    portable_window_features,
    window_states_from,
)
from aegis.forecasting.states import STATE_NAMES  # noqa: E402

CIC_FULL = {"cic2018", "darpa2000"}


def build(name: str) -> tuple[pd.DataFrame, pd.DataFrame | None, dict]:
    t0 = time.time()
    flows, spec = DS.ADAPTERS[name]()
    nets = parse_networks(spec.internal_networks)
    portable, full = [], []
    for seg, f in flows.groupby("segment", sort=False):
        ef = entity_flows(f.sort_values("timestamp", kind="stable"), nets, 60)
        active = ef["entity"].value_counts()
        ef = ef[ef["entity"].isin(active[active >= spec.min_entity_flows].index)]
        if ef.empty:
            continue
        x = portable_window_features(ef, 60)
        y = window_states_from(ef, "state", 60, spec.min_attack_flows)
        t = x.join(y, how="inner").reset_index()
        t.insert(0, "day", seg)
        t.insert(0, "dataset", name)
        portable.append(t)
        if name in CIC_FULL:
            xf = entity_window_features(ef, 60).join(y, how="inner").reset_index()
            xf.insert(0, "day", seg)
            xf.insert(0, "dataset", name)
            full.append(xf)
    p = pd.concat(portable, ignore_index=True).sort_values(["day", "entity", "window_start"], kind="stable")
    info = {"flows": int(len(flows)), "rows": int(len(p)), "hosts": int(p.groupby("day")["entity"].nunique().sum()),
            "segments": sorted(p["day"].unique().tolist()), "internal_networks": spec.internal_networks,
            "description": spec.description,
            "state_minutes": {STATE_NAMES[k]: int(v) for k, v in p["state"].value_counts().sort_index().items()}}
    print(f"{name:9s} flows={info['flows']:>9,d} host-minutes={info['rows']:>7,d} hosts={info['hosts']:3d} "
          f"states={info['state_minutes']} ({time.time() - t0:.0f}s)", flush=True)
    return p, (pd.concat(full, ignore_index=True) if full else None), info


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--datasets", nargs="+", default=list(DS.ADAPTERS))
    ap.add_argument("--append", action="store_true", help="replace only these datasets in the existing tables")
    args = ap.parse_args()
    out = ROOT / "data" / "processed"
    tables, fulls, meta = [], [], {}
    for name in args.datasets:
        p, full, info = build(name)
        tables.append(p)
        meta[name] = info
        if full is not None:
            fulls.append(full)
    if args.append:
        for fname, lst in (("windows_multi.parquet", tables), ("windows_cicfull_ext.parquet", fulls)):
            old = out / fname
            if old.is_file():
                prev = pd.read_parquet(old)
                lst.insert(0, prev[~prev["dataset"].isin(args.datasets)])
        old_meta = json.loads((out / "windows_multi_meta.json").read_text())["datasets"]
        meta = {**{k: v for k, v in old_meta.items() if k not in args.datasets}, **meta}
    pd.concat(tables, ignore_index=True).to_parquet(out / "windows_multi.parquet", index=False)
    if fulls:
        pd.concat(fulls, ignore_index=True).to_parquet(out / "windows_cicfull_ext.parquet", index=False)
    (out / "windows_multi_meta.json").write_text(json.dumps(
        {"features": PORTABLE_FEATURE_NAMES, "cic_full_features": FEATURE_NAMES, "states": STATE_NAMES, "datasets": meta}, indent=1))


if __name__ == "__main__":
    main()
