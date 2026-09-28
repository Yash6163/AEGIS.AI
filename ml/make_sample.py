"""Cut a small, real CIC-IDS2017 flow file for trying the upload path.

Writes data/samples/<name>.csv.gz with the original CICFlowMeter column names
(only the columns the pipeline uses, plus Label) and ISO timestamps.

Usage: python ml/make_sample.py [--day thursday --start 12:05 --minutes 45]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "ml"))

from prepare_windows import DAYS  # noqa: E402

from aegis.forecasting.features import COLUMN_ALIASES  # noqa: E402

DATES = {"monday": "2017-07-03", "tuesday": "2017-07-04", "wednesday": "2017-07-05", "thursday": "2017-07-06", "friday": "2017-07-07"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", default="thursday", choices=list(DAYS))
    ap.add_argument("--start", default="12:05", help="UTC HH:MM")
    ap.add_argument("--minutes", type=int, default=75)
    args = ap.parse_args()
    wanted = [aliases[0] for aliases in COLUMN_ALIASES.values()]
    parts = []
    for name in DAYS[args.day]:
        df = pd.read_parquet(ROOT / "data" / "raw" / f"{name}.parquet")
        df.columns = [c.strip() for c in df.columns]
        parts.append(df[wanted].dropna(subset=["Timestamp"]))
    df = pd.concat(parts, ignore_index=True)
    t0 = pd.Timestamp(f"{DATES[args.day]} {args.start}")
    df = df[(df["Timestamp"] >= t0) & (df["Timestamp"] < t0 + pd.Timedelta(minutes=args.minutes))]
    df = df.sort_values("Timestamp")
    df["Timestamp"] = df["Timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")
    out = ROOT / "data" / "samples"
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"cicids2017_{args.day}_{args.start.replace(':', '')}_{args.minutes}min.csv.gz"
    df.to_csv(path, index=False, compression="gzip")
    print(f"{path} rows={len(df):,} size={path.stat().st_size / 1e6:.1f} MB labels={df['Label'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
