"""Dataset adapters: raw files -> canonical flow table with a per-flow `state`.

Every adapter returns (flows, spec) where flows has at least the portable
columns (timestamp, src_ip, dst_ip, dst_port, protocol, duration_us,
total_pkts, fwd_bytes, bwd_bytes) plus an integer `state` column, and spec
describes the capture: internal networks (whose hosts become entities), the
labelling threshold, and how to split captures into segments ("days").

Sources (see ml/README.md for download commands):
  cic2017   CIC-IDS2017 GeneratedLabelledFlows         data/raw/*.parquet
  unsw      UNSW-NB15 raw records (Argus+Bro)           data/raw_ext/unsw/raw_data.parquet
  ctu13     CTU-13 bidirectional NetFlow, 8 scenarios   data/raw_ext/ctu13/ctu*.binetflow
  cic2018   CSE-CIC-IDS2018 20-Feb-2018 (only day w/IPs) data/raw_ext/cic2018/Tuesday-20-02-2018.csv
  darpa2000 DARPA 2000 LLDOS 1.0 inside PCAP + phase labels data/raw_ext/darpa2000/
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET  # noqa: S405 - trusted, locally downloaded label files

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from aegis.forecasting.features import normalise_flows  # noqa: E402
from aegis.forecasting.states import (  # noqa: E402
    CICIDS2018_LABEL_MAP,
    DARPA2000_PHASE_MAP,
    UNSW_NB15_LABEL_MAP,
    AttackState,
    map_ctu13_label,
    map_label,
    normalise_label,
)

RAW, EXT = ROOT / "data" / "raw", ROOT / "data" / "raw_ext"
PROTO = {"tcp": 6, "udp": 17, "icmp": 1}


@dataclass
class Spec:
    name: str
    internal_networks: str
    min_attack_flows: int = 2
    min_entity_flows: int = 100
    description: str = ""


def _proto(series: pd.Series) -> pd.Series:
    return series.astype(str).str.lower().str.strip().map(PROTO).fillna(0).astype(int)


def _port(series: pd.Series) -> pd.Series:
    """Ports may be decimal, hex ('0x0303') or empty."""
    s = series.astype(str).str.strip()
    hexm = s.str.startswith("0x")
    out = pd.to_numeric(s.where(~hexm), errors="coerce")
    out[hexm] = s[hexm].map(lambda v: int(v, 16) if re.fullmatch(r"0x[0-9a-fA-F]+", v) else np.nan)
    return out.fillna(0).astype(int)


# ------------------------------------------------------------------ CIC-IDS2017
def cic2017() -> tuple[pd.DataFrame, Spec]:
    import prepare_windows as P
    parts = []
    for day, files in P.DAYS.items():
        dfs = []
        for name in files:
            d = pd.read_parquet(RAW / f"{name}.parquet")
            d.columns = [c.strip() for c in d.columns]
            dfs.append(d)
        flows, _ = normalise_flows(pd.concat(dfs, ignore_index=True))
        flows["segment"] = f"cic2017-{day}"
        parts.append(flows)
    f = pd.concat(parts, ignore_index=True)
    f["state"] = f["label"].map(lambda x: int(map_label(x)))
    f["total_pkts"] = f["fwd_pkts"] + f["bwd_pkts"]
    return f, Spec("cic2017", "192.168.10.0/24", 2, 100, "CIC-IDS2017, 5 days, 14 LAN hosts")


# ------------------------------------------------------------------ UNSW-NB15
def unsw() -> tuple[pd.DataFrame, Spec]:
    u = pd.read_parquet(EXT / "unsw" / "raw_data.parquet")
    cat = u["attack_cat"].astype(str).str.strip().map(normalise_label)
    cat = cat.where(u["Label"].astype(int) == 1, "normal")
    unknown = sorted(set(cat) - set(UNSW_NB15_LABEL_MAP))
    if unknown:
        raise ValueError(f"unmapped UNSW categories: {unknown}")
    spk, dpk = u["Spkts"].astype(float), u["Dpkts"].astype(float)
    f = pd.DataFrame({
        "timestamp": pd.to_datetime(pd.to_numeric(u["Stime"]), unit="s"),
        "src_ip": u["srcip"].astype(str), "dst_ip": u["dstip"].astype(str),
        "src_port": _port(u["sport"]), "dst_port": _port(u["dsport"]),
        "protocol": _proto(u["proto"]),
        "duration_us": u["dur"].astype(float) * 1e6,
        "fwd_pkts": spk, "bwd_pkts": dpk, "total_pkts": spk + dpk,
        "fwd_bytes": u["sbytes"].astype(float), "bwd_bytes": u["dbytes"].astype(float),
        # packet-level fields (Argus): TTL per direction, TCP window, mean payload
        "ttl_fwd_mean": u["sttl"].astype(float), "ttl_bwd_mean": u["dttl"].astype(float),
        "init_win_fwd": u["swin"].astype(float), "init_win_bwd": u["dwin"].astype(float),
        "payload_mean": ((u["smeansz"] * spk + u["dmeansz"] * dpk) / (spk + dpk).where(spk + dpk > 0, 1)).astype(float),
        "state": cat.map(lambda c: int(UNSW_NB15_LABEL_MAP[c])),
    })
    # two capture sessions (22-23 Jan 2015, 17-18 Feb 2015); split on the gap, not the date
    f["segment"] = np.where(f["timestamp"] < pd.Timestamp("2015-02-01"), "unsw-capture1", "unsw-capture2")
    return f.sort_values("timestamp", kind="stable").reset_index(drop=True), Spec(
        "unsw", "149.171.126.0/24,59.166.0.0/24", 2, 100, "UNSW-NB15 (UNSW Canberra Cyber Range, IXIA PerfectStorm), 2 captures")


# ------------------------------------------------------------------ CTU-13
def ctu13() -> tuple[pd.DataFrame, Spec]:
    parts = []
    for path in sorted((EXT / "ctu13").glob("ctu*.binetflow")):
        d = pd.read_csv(path, usecols=["StartTime", "Dur", "Proto", "SrcAddr", "Sport", "DstAddr", "Dport",
                                        "TotPkts", "TotBytes", "SrcBytes", "Label"], dtype=str, low_memory=False)
        tot, src = pd.to_numeric(d["TotBytes"], errors="coerce").fillna(0), pd.to_numeric(d["SrcBytes"], errors="coerce").fillna(0)
        f = pd.DataFrame({
            "timestamp": pd.to_datetime(d["StartTime"], format="%Y/%m/%d %H:%M:%S.%f", errors="coerce"),
            "src_ip": d["SrcAddr"].astype(str), "dst_ip": d["DstAddr"].astype(str),
            "src_port": _port(d["Sport"]), "dst_port": _port(d["Dport"]), "protocol": _proto(d["Proto"]),
            "duration_us": pd.to_numeric(d["Dur"], errors="coerce").fillna(0) * 1e6,
            "total_pkts": pd.to_numeric(d["TotPkts"], errors="coerce").fillna(0),
            "fwd_bytes": src, "bwd_bytes": (tot - src).clip(lower=0),
            "state": d["Label"].map(lambda x: int(map_ctu13_label(x))),
        }).dropna(subset=["timestamp"])
        f["segment"] = "ctu13-" + path.stem.replace("ctu", "s")
        parts.append(f)
        print(f"  {path.name}: {len(f):,} flows")
    f = pd.concat(parts, ignore_index=True)
    return f, Spec("ctu13", "147.32.84.0/24", 2, 100, "CTU-13 botnet captures (scenarios 43,45-48,51-53)")


# ------------------------------------------------------------------ CSE-CIC-IDS2018
def cic2018() -> tuple[pd.DataFrame, Spec]:
    path = EXT / "cic2018" / "Tuesday-20-02-2018.csv"
    keep = ["Src IP", "Dst IP", "Src Port", "Dst Port", "Protocol", "Timestamp", "Flow Duration", "Tot Fwd Pkts",
            "Tot Bwd Pkts", "TotLen Fwd Pkts", "TotLen Bwd Pkts", "Flow IAT Mean", "Flow IAT Std", "Flow IAT Max",
            "SYN Flag Cnt", "FIN Flag Cnt", "RST Flag Cnt", "PSH Flag Cnt", "ACK Flag Cnt", "URG Flag Cnt",
            "Pkt Len Mean", "Init Fwd Win Byts", "Init Bwd Win Byts", "Label"]
    parts = []
    for chunk in pd.read_csv(path, usecols=keep, chunksize=1_000_000, dtype=str, low_memory=False):
        chunk = chunk[chunk["Label"] != "Label"]  # repeated header rows inside the CSV
        flows, _ = normalise_flows(chunk)
        parts.append(flows)
    f = pd.concat(parts, ignore_index=True)
    labels = f["label"].map(normalise_label)
    unknown = sorted(set(labels) - set(CICIDS2018_LABEL_MAP))
    if unknown:
        raise ValueError(f"unmapped CIC-IDS2018 labels: {unknown}")
    f["state"] = labels.map(lambda x: int(CICIDS2018_LABEL_MAP[x]))
    f["total_pkts"] = f["fwd_pkts"] + f["bwd_pkts"]
    f["segment"] = "cic2018-tue-20-02"
    return f.sort_values("timestamp", kind="stable").reset_index(drop=True), Spec(
        "cic2018", "172.31.0.0/16", 2, 100, "CSE-CIC-IDS2018 20-Feb-2018 (AWS; DDoS LOIC-HTTP/UDP)")


# ------------------------------------------------------------------ DARPA 2000
def _darpa_alerts() -> pd.DataFrame:
    rows = []
    for phase in range(1, 6):
        text = (EXT / "darpa2000" / f"inside-phase-{phase}.xml").read_text(errors="replace")
        for block in re.findall(r"<Alert .*?</Alert>", text, re.S):
            a = ET.fromstring(block)
            date, tm, dur = a.findtext("Time/date"), a.findtext("Time/time"), a.findtext("Time/sessionduration")
            addrs = [e.text for e in a.iter("address")]
            if not (date and tm and len(addrs) >= 2):
                continue
            start = datetime.strptime(f"{date} {tm}", "%m/%d/%Y %H:%M:%S") + timedelta(hours=5)  # EST -> UTC
            h, m, s = (int(x) for x in (dur or "0:0:0").split(":"))
            rows.append((phase, start, start + timedelta(hours=h, minutes=m, seconds=s), addrs[0], addrs[1]))
    return pd.DataFrame(rows, columns=["phase", "start", "end", "a", "b"])


def darpa2000() -> tuple[pd.DataFrame, Spec]:
    sys.path.insert(0, str(ROOT / "backend"))
    from aegis.ingestion.pcap import read_pcap_flows
    cache = EXT / "darpa2000" / "inside_flows.parquet"
    f = pd.read_parquet(cache) if cache.is_file() else read_pcap_flows(EXT / "darpa2000" / "inside.dump.gz")[0]
    f["total_pkts"] = f["fwd_pkts"] + f["bwd_pkts"]
    f["state"] = int(AttackState.NORMAL)
    alerts = _darpa_alerts()
    lo, hi = np.minimum(f["src_ip"], f["dst_ip"]), np.maximum(f["src_ip"], f["dst_ip"])
    f["pair"] = lo + "|" + hi
    alerts["pair"] = np.minimum(alerts["a"], alerts["b"]) + "|" + np.maximum(alerts["a"], alerts["b"])
    m = f.reset_index().merge(alerts, on="pair")
    tol = pd.Timedelta(seconds=2)
    m = m[(m["timestamp"] >= m["start"] - tol) & (m["timestamp"] <= m["end"] + tol)]
    phase = m.groupby("index")["phase"].max()
    f.loc[phase.index, "state"] = phase.map(lambda p: int(DARPA2000_PHASE_MAP[p])).values
    f["segment"] = "darpa2000-lldos1"
    return f.drop(columns="pair"), Spec("darpa2000", "172.16.0.0/16", 1, 20,
                                        "DARPA 2000 LLDOS 1.0 (inside sensor), 5-phase DDoS kill chain, from PCAP")


ADAPTERS = {"cic2017": cic2017, "unsw": unsw, "ctu13": ctu13, "cic2018": cic2018, "darpa2000": darpa2000}
