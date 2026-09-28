"""Stage 1: CIC-IDS2017 labelled flows -> per-host, per-minute window table.

Input : data/raw/*.parquet  (CIC-IDS2017 GeneratedLabelledFlows, see ml/README.md)
Output: data/processed/windows.parquet
        one row per (day, internal host, 60 s window): 37 features,
        ground-truth state, per-state labelled flow counts, display statistics.

Usage: python ml/prepare_windows.py [--raw data/raw] [--out data/processed]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from aegis.forecasting.features import (  # noqa: E402
    FEATURE_NAMES,
    entity_flows,
    entity_raw_stats,
    entity_window_features,
    entity_window_states,
    normalise_flows,
    parse_networks,
)
from aegis.forecasting.states import STATE_NAMES  # noqa: E402

DAYS = {
    "monday": ["Monday-WorkingHours"],
    "tuesday": ["Tuesday-WorkingHours"],
    "wednesday": ["Wednesday-workingHours"],
    "thursday": ["Thursday-WorkingHours-Morning-WebAttacks", "Thursday-WorkingHours-Afternoon-Infilteration"],
    "friday": [
        "Friday-WorkingHours-Morning",
        "Friday-WorkingHours-Afternoon-PortScan",
        "Friday-WorkingHours-Afternoon-DDos",
    ],
}
WINDOW_SECONDS = 60
MIN_ATTACK_FLOWS = 2
# The CIC-IDS2017 victim LAN. Entities = hosts inside it (broadcast excluded).
INTERNAL_NETWORKS = "192.168.10.0/24"
MIN_ENTITY_FLOWS_PER_DAY = 100


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--out", default="data/processed")
    args = ap.parse_args()
    raw, out = Path(args.raw), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    frames, provenance = [], {}
    for day, files in DAYS.items():
        t0 = time.time()
        parts = []
        for name in files:
            path = raw / f"{name}.parquet"
            provenance[path.name] = sha256(path)
            df = pd.read_parquet(path)
            df.columns = [c.strip() for c in df.columns]
            parts.append(df)
        flows, warnings = normalise_flows(pd.concat(parts, ignore_index=True))
        flows = flows.sort_values("timestamp", kind="stable")
        ef = entity_flows(flows, parse_networks(INTERNAL_NETWORKS), WINDOW_SECONDS)
        active = ef["entity"].value_counts()
        ef = ef[ef["entity"].isin(active[active >= MIN_ENTITY_FLOWS_PER_DAY].index)]
        feats = entity_window_features(ef, WINDOW_SECONDS)
        states = entity_window_states(ef, WINDOW_SECONDS, MIN_ATTACK_FLOWS)
        stats = entity_raw_stats(ef, WINDOW_SECONDS)
        table = feats.join(states, how="inner").join(stats, how="inner").reset_index()
        table.insert(0, "day", day)
        table = table.sort_values(["entity", "window_start"]).reset_index(drop=True)
        frames.append(table)
        counts = table["state"].value_counts().sort_index()
        print(
            f"{day:9s} flows={len(flows):>8,d} hosts={table.entity.nunique():2d} rows={len(table):5d} "
            f"states={{{', '.join(f'{STATE_NAMES[k]}:{v}' for k, v in counts.items())}}} "
            f"({time.time() - t0:.1f}s) {' '.join(warnings)}"
        )

    windows = pd.concat(frames, ignore_index=True)
    windows.to_parquet(out / "windows.parquet", index=False)
    meta = {
        "dataset": "CIC-IDS2017 (GeneratedLabelledFlows, HF mirror bvsam/cic-ids-2017)",
        "window_seconds": WINDOW_SECONDS,
        "internal_networks": INTERNAL_NETWORKS,
        "entities": sorted(windows["entity"].unique().tolist()),
        "min_attack_flows": MIN_ATTACK_FLOWS,
        "features": FEATURE_NAMES,
        "states": STATE_NAMES,
        "n_windows": len(windows),
        "state_counts": {STATE_NAMES[k]: int(v) for k, v in windows["state"].value_counts().sort_index().items()},
        "raw_file_sha256": provenance,
    }
    (out / "windows_meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta["state_counts"], indent=2))


if __name__ == "__main__":
    main()
