"""Flow-record formats accepted for analysis and their canonical conversion.

profile   detected from                        model feature set
-------   -------------------------------      -----------------
cic       CICFlowMeter CSV (CIC-IDS2017/2018)  cic (37 features)  or portable
binetflow Argus/CTU-13 bidirectional NetFlow   portable (26 features)
unsw      UNSW-NB15 / Argus+Bro CSV            portable
pcap      libpcap capture (flows built here)   portable

Every converter returns the canonical flow table (timestamp, src_ip, dst_ip,
src_port, dst_port, protocol, duration_us, total_pkts, fwd_bytes, bwd_bytes,
...). An optional `label` column is kept for display/evaluation only.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..forecasting.features import COLUMN_ALIASES, FlowSchemaError, _key, normalise_flows

PROTO = {"tcp": 6, "udp": 17, "icmp": 1}
BINETFLOW_COLUMNS = ["StartTime", "Dur", "Proto", "SrcAddr", "Sport", "DstAddr", "Dport", "TotPkts", "TotBytes", "SrcBytes"]
UNSW_COLUMNS = ["srcip", "sport", "dstip", "dsport", "proto", "dur", "sbytes", "dbytes", "Spkts", "Dpkts", "Stime",
                "sttl", "dttl", "swin", "dwin", "smeansz", "dmeansz"]
LABEL_COLUMNS = ["Label", "label", "attack_cat"]

ALLOWED_KEYS = ({_key(a) for aliases in COLUMN_ALIASES.values() for a in aliases}
                | {_key(c) for c in BINETFLOW_COLUMNS + UNSW_COLUMNS + LABEL_COLUMNS})


def _proto(series: pd.Series) -> pd.Series:
    s = series.astype(str).str.lower().str.strip()
    num = pd.to_numeric(s, errors="coerce")
    return num.fillna(s.map(PROTO)).fillna(0).astype(int)


def port(series: pd.Series) -> pd.Series:
    """Ports may be decimal, hex ('0x0303') or empty."""
    s = series.astype(str).str.strip()
    hexm = s.str.match(r"^0x[0-9a-fA-F]+$")
    out = pd.to_numeric(s.where(~hexm), errors="coerce")
    out[hexm] = s[hexm].map(lambda v: int(v, 16))
    return out.fillna(0).astype(int)


def detect(columns: list[str]) -> str:
    keys = {_key(c) for c in columns}
    if {_key(c) for c in BINETFLOW_COLUMNS} <= keys:
        return "binetflow"
    if {_key(c) for c in ["srcip", "dstip", "Stime", "sbytes", "dbytes", "Spkts", "Dpkts"]} <= keys:
        return "unsw"
    return "cic"


def _col(df: pd.DataFrame, name: str) -> pd.Series:
    by_key = {_key(c): c for c in df.columns}
    return df[by_key[_key(name)]]


def from_binetflow(df: pd.DataFrame) -> pd.DataFrame:
    tot = pd.to_numeric(_col(df, "TotBytes"), errors="coerce").fillna(0)
    src = pd.to_numeric(_col(df, "SrcBytes"), errors="coerce").fillna(0)
    ts = pd.to_datetime(_col(df, "StartTime").astype(str).str.strip(), format="mixed", errors="coerce")
    out = pd.DataFrame({
        "timestamp": ts,
        "src_ip": _col(df, "SrcAddr").astype(str), "dst_ip": _col(df, "DstAddr").astype(str),
        "src_port": port(_col(df, "Sport")), "dst_port": port(_col(df, "Dport")), "protocol": _proto(_col(df, "Proto")),
        "duration_us": pd.to_numeric(_col(df, "Dur"), errors="coerce").fillna(0) * 1e6,
        "total_pkts": pd.to_numeric(_col(df, "TotPkts"), errors="coerce").fillna(0),
        "fwd_bytes": src, "bwd_bytes": (tot - src).clip(lower=0),
    })
    if any(_key(c) == "label" for c in df.columns):
        out["label"] = _col(df, "Label").astype(str)
    return out.dropna(subset=["timestamp"]).reset_index(drop=True)


def from_unsw(df: pd.DataFrame) -> pd.DataFrame:
    spk = pd.to_numeric(_col(df, "Spkts"), errors="coerce").fillna(0)
    dpk = pd.to_numeric(_col(df, "Dpkts"), errors="coerce").fillna(0)
    out = pd.DataFrame({
        "timestamp": pd.to_datetime(pd.to_numeric(_col(df, "Stime"), errors="coerce"), unit="s"),
        "src_ip": _col(df, "srcip").astype(str), "dst_ip": _col(df, "dstip").astype(str),
        "src_port": port(_col(df, "sport")), "dst_port": port(_col(df, "dsport")), "protocol": _proto(_col(df, "proto")),
        "duration_us": pd.to_numeric(_col(df, "dur"), errors="coerce").fillna(0) * 1e6,
        "fwd_pkts": spk, "bwd_pkts": dpk, "total_pkts": spk + dpk,
        "fwd_bytes": pd.to_numeric(_col(df, "sbytes"), errors="coerce").fillna(0),
        "bwd_bytes": pd.to_numeric(_col(df, "dbytes"), errors="coerce").fillna(0),
    })
    for c in ("sttl", "dttl", "swin", "dwin"):
        if any(_key(x) == c for x in df.columns):
            out[{"sttl": "ttl_fwd_mean", "dttl": "ttl_bwd_mean", "swin": "init_win_fwd", "dwin": "init_win_bwd"}[c]] = (
                pd.to_numeric(_col(df, c), errors="coerce").fillna(0))
    if any(_key(c) == "attackcat" for c in df.columns):
        out["label"] = _col(df, "attack_cat").astype(str).str.strip().replace({"": "normal", "nan": "normal"})
    return out.dropna(subset=["timestamp"]).reset_index(drop=True)


def to_canonical(df: pd.DataFrame) -> tuple[pd.DataFrame, str, list[str]]:
    """Detect the CSV format and convert. Returns (flows, profile, warnings)."""
    profile = detect(list(df.columns))
    if profile == "binetflow":
        flows, warnings = from_binetflow(df), []
    elif profile == "unsw":
        flows, warnings = from_unsw(df), []
    else:
        flows, warnings = normalise_flows(df)
        flows["total_pkts"] = flows["fwd_pkts"] + flows["bwd_pkts"]
    if flows.empty:
        raise FlowSchemaError("no usable flow rows after parsing")
    for c in ("src_ip", "dst_ip"):
        flows[c] = flows[c].astype(str)
    flows = flows[np.isfinite(flows["duration_us"])]
    return flows, profile, warnings

