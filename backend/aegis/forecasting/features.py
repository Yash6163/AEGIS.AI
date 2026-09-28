"""Flow normalisation and window-level feature extraction.

Pipeline: CICFlowMeter flow records -> canonical flow table -> fixed-length
time windows -> one feature vector per window (the observed network state x_t).

Every feature is computed from basic per-flow attributes (5-tuple, packet and
byte counts, duration, IAT statistics, TCP flag counts, initial TCP window),
so a future PCAP/NetFlow source only has to produce the canonical flow table.
"""

from __future__ import annotations

import ipaddress

import numpy as np
import pandas as pd

from .states import NUM_STATES, AttackState, map_label

# canonical name -> accepted source column names (compared after `_key`)
COLUMN_ALIASES: dict[str, list[str]] = {
    "timestamp": ["Timestamp"],
    "src_ip": ["Source IP", "Src IP"],
    "dst_ip": ["Destination IP", "Dst IP"],
    "src_port": ["Source Port", "Src Port"],
    "dst_port": ["Destination Port", "Dst Port"],
    "protocol": ["Protocol"],
    "duration_us": ["Flow Duration"],
    "fwd_pkts": ["Total Fwd Packets", "Tot Fwd Pkts"],
    "bwd_pkts": ["Total Backward Packets", "Tot Bwd Pkts"],
    "fwd_bytes": ["Total Length of Fwd Packets", "TotLen Fwd Pkts"],
    "bwd_bytes": ["Total Length of Bwd Packets", "TotLen Bwd Pkts"],
    "iat_mean": ["Flow IAT Mean"],
    "iat_std": ["Flow IAT Std"],
    "iat_max": ["Flow IAT Max"],
    "syn": ["SYN Flag Count", "SYN Flag Cnt"],
    "fin": ["FIN Flag Count", "FIN Flag Cnt"],
    "rst": ["RST Flag Count", "RST Flag Cnt"],
    "psh": ["PSH Flag Count", "PSH Flag Cnt"],
    "ack": ["ACK Flag Count", "ACK Flag Cnt"],
    "urg": ["URG Flag Count", "URG Flag Cnt"],
    "pkt_len_mean": ["Packet Length Mean", "Pkt Len Mean"],
    "init_win_fwd": ["Init_Win_bytes_forward", "Init Fwd Win Byts"],
    "init_win_bwd": ["Init_Win_bytes_backward", "Init Bwd Win Byts"],
    "label": ["Label"],
}
REQUIRED_COLUMNS = [c for c in COLUMN_ALIASES if c != "label"]
NUMERIC_COLUMNS = [c for c in REQUIRED_COLUMNS if c not in ("timestamp", "src_ip", "dst_ip")]

FEATURE_NAMES: list[str] = [
    "log_flows",
    "log_fwd_pkts",
    "log_bwd_pkts",
    "log_fwd_bytes",
    "log_bwd_bytes",
    "log_bwd_fwd_pkt_ratio",
    "mean_log_duration",
    "std_log_duration",
    "mean_log_iat_mean",
    "mean_log_iat_std",
    "mean_log_iat_max",
    "syn_rate",
    "fin_rate",
    "rst_rate",
    "psh_rate",
    "ack_rate",
    "urg_rate",
    "log_uniq_src_ip",
    "log_uniq_dst_ip",
    "log_uniq_dst_port",
    "dst_port_entropy",
    "src_ip_entropy",
    "dst_ip_entropy",
    "tcp_frac",
    "udp_frac",
    "no_reply_frac",
    "short_flow_frac",
    "mean_log_pkt_len",
    "mean_log_init_win_fwd",
    "mean_log_init_win_bwd",
    "top_src_share",
    "top_dst_share",
    "log_max_src_port_fanout",
    "log_max_src_host_fanout",
    "wellknown_port_frac",
    "outbound_frac",
    "external_peer_frac",
]
NUM_FEATURES = len(FEATURE_NAMES)

# Human-readable descriptions used by the explanation layer.
FEATURE_DESCRIPTIONS: dict[str, str] = {
    "log_flows": "flows started in the window",
    "log_fwd_pkts": "forward packets",
    "log_bwd_pkts": "backward (reply) packets",
    "log_fwd_bytes": "forward bytes",
    "log_bwd_bytes": "backward bytes",
    "log_bwd_fwd_pkt_ratio": "reply/request packet ratio",
    "mean_log_duration": "typical flow duration",
    "std_log_duration": "spread of flow durations",
    "mean_log_iat_mean": "mean inter-arrival time",
    "mean_log_iat_std": "inter-arrival time variance",
    "mean_log_iat_max": "maximum inter-arrival time",
    "syn_rate": "SYN flags per flow",
    "fin_rate": "FIN flags per flow",
    "rst_rate": "RST flags per flow",
    "psh_rate": "PSH flags per flow",
    "ack_rate": "ACK flags per flow",
    "urg_rate": "URG flags per flow",
    "log_uniq_src_ip": "distinct source IPs",
    "log_uniq_dst_ip": "distinct destination IPs",
    "log_uniq_dst_port": "distinct destination ports",
    "dst_port_entropy": "destination-port entropy",
    "src_ip_entropy": "source-IP entropy",
    "dst_ip_entropy": "destination-IP entropy",
    "tcp_frac": "share of TCP flows",
    "udp_frac": "share of UDP flows",
    "no_reply_frac": "share of flows with no reply",
    "short_flow_frac": "share of sub-millisecond flows",
    "mean_log_pkt_len": "mean packet length",
    "mean_log_init_win_fwd": "initial TCP window (client)",
    "mean_log_init_win_bwd": "initial TCP window (server)",
    "top_src_share": "traffic share of busiest source",
    "top_dst_share": "traffic share of busiest destination",
    "log_max_src_port_fanout": "max ports probed by one source",
    "log_max_src_host_fanout": "max hosts contacted by one source",
    "wellknown_port_frac": "share of flows to ports < 1024",
    "outbound_frac": "share of flows initiated by the host",
    "external_peer_frac": "share of flows with external peers",
}


class FlowSchemaError(ValueError):
    """Raised when an uploaded flow table cannot be mapped to the schema."""


def _key(name: str) -> str:
    return "".join(ch for ch in str(name).lower() if ch.isalnum())


def resolve_columns(columns: list[str]) -> dict[str, str]:
    """Return {source_column: canonical_name}; raise if required ones are missing."""
    by_key = {_key(c): c for c in columns}
    mapping: dict[str, str] = {}
    missing: list[str] = []
    for canonical, aliases in COLUMN_ALIASES.items():
        found = next((by_key[_key(a)] for a in aliases if _key(a) in by_key), None)
        if found is None:
            if canonical != "label":
                missing.append(f"{canonical} (e.g. '{aliases[0]}')")
        else:
            mapping[found] = canonical
    if missing:
        raise FlowSchemaError("missing required columns: " + ", ".join(missing))
    return mapping


def parse_timestamps(raw: pd.Series) -> tuple[pd.Series, list[str]]:
    """Parse flow timestamps. Returns (naive datetime series, warnings).

    The raw CIC-IDS2017 CSVs use day-first dates and a 12-hour clock without
    AM/PM ("7/7/2017 3:30" meaning 15:30). When a file mixes morning hours with
    hours 1-7 we shift the latter by 12h and report it.
    """
    warnings: list[str] = []
    if pd.api.types.is_datetime64_any_dtype(raw):
        ts = raw
    else:
        ts = pd.to_datetime(raw.astype(str).str.strip(), format="mixed", dayfirst=True, errors="coerce")
    if getattr(ts.dt, "tz", None) is not None:
        ts = ts.dt.tz_convert("UTC").dt.tz_localize(None)
    hours = ts.dt.hour
    if hours.between(1, 7).any() and hours.between(8, 12).any() and not hours.between(13, 23).any():
        ts = ts.where(~hours.between(1, 7), ts + pd.Timedelta(hours=12))
        warnings.append("12-hour clock without AM/PM detected; hours 1-7 shifted to 13-19.")
    bad = int(ts.isna().sum())
    if bad:
        warnings.append(f"{bad} rows with unparseable timestamps were dropped.")
    return ts, warnings


def normalise_flows(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Map a CICFlowMeter table onto the canonical flow schema."""
    mapping = resolve_columns(list(df.columns))
    out = df[list(mapping)].rename(columns=mapping)
    ts, warnings = parse_timestamps(out["timestamp"])
    out = out.assign(timestamp=ts)
    for col in NUMERIC_COLUMNS:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    num = out[NUMERIC_COLUMNS].to_numpy(dtype=np.float64)
    num[~np.isfinite(num)] = np.nan
    out[NUMERIC_COLUMNS] = num
    before = len(out)
    out = out.dropna(subset=["timestamp", "dst_port", "protocol", "duration_us"])
    out[NUMERIC_COLUMNS] = out[NUMERIC_COLUMNS].fillna(0.0)
    dropped = before - len(out)
    if dropped and not any("unparseable" in w for w in warnings):
        warnings.append(f"{dropped} rows with missing core fields were dropped.")
    out["src_ip"] = out["src_ip"].astype(str)
    out["dst_ip"] = out["dst_ip"].astype(str)
    if "label" in out:
        out["label"] = out["label"].astype(str)
    return out.reset_index(drop=True), warnings


def _entropy(keys: list[pd.Series], values: pd.Series) -> pd.Series:
    counts = pd.concat([*keys, values.rename("_v")], axis=1).groupby([k.name for k in keys] + ["_v"], sort=False).size()
    lv = list(range(len(keys)))
    p = counts / counts.groupby(level=lv).transform("sum")
    return (-(p * np.log2(p))).groupby(level=lv).sum()


def _aggregate(f: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """Feature rows grouped by `keys` (the last key is the window start)."""
    g = f.groupby(keys, sort=True)
    n = g.size().astype(float)
    kser = [f[k] for k in keys]

    def s(col: str) -> pd.Series:
        return g[col].sum()

    def m(values) -> pd.Series:
        return pd.Series(np.asarray(values, dtype=float), index=f.index).groupby(kser).mean()

    def top_share(col: str) -> pd.Series:
        return f.groupby([*keys, col]).size().groupby(level=list(range(len(keys)))).max() / n

    def fanout(col: str) -> pd.Series:
        return np.log1p(f.groupby([*keys, "src_ip"])[col].nunique().groupby(level=list(range(len(keys)))).max())

    log_dur = pd.Series(np.log1p(f["duration_us"].clip(lower=0)).values, index=f.index)
    x = pd.DataFrame(index=n.index)
    x["log_flows"] = np.log1p(n)
    x["log_fwd_pkts"] = np.log1p(s("fwd_pkts").clip(lower=0))
    x["log_bwd_pkts"] = np.log1p(s("bwd_pkts").clip(lower=0))
    x["log_fwd_bytes"] = np.log1p(s("fwd_bytes").clip(lower=0))
    x["log_bwd_bytes"] = np.log1p(s("bwd_bytes").clip(lower=0))
    x["log_bwd_fwd_pkt_ratio"] = np.log((s("bwd_pkts").clip(lower=0) + 1) / (s("fwd_pkts").clip(lower=0) + 1))
    x["mean_log_duration"] = log_dur.groupby(kser).mean()
    x["std_log_duration"] = log_dur.groupby(kser).std(ddof=0)
    x["mean_log_iat_mean"] = m(np.log1p(f["iat_mean"].clip(lower=0)))
    x["mean_log_iat_std"] = m(np.log1p(f["iat_std"].clip(lower=0)))
    x["mean_log_iat_max"] = m(np.log1p(f["iat_max"].clip(lower=0)))
    for flag in ("syn", "fin", "rst", "psh", "ack", "urg"):
        x[f"{flag}_rate"] = s(flag).clip(lower=0) / n
    x["log_uniq_src_ip"] = np.log1p(g["src_ip"].nunique())
    x["log_uniq_dst_ip"] = np.log1p(g["dst_ip"].nunique())
    x["log_uniq_dst_port"] = np.log1p(g["dst_port"].nunique())
    x["dst_port_entropy"] = _entropy(kser, f["dst_port"])
    x["src_ip_entropy"] = _entropy(kser, f["src_ip"])
    x["dst_ip_entropy"] = _entropy(kser, f["dst_ip"])
    x["tcp_frac"] = m(f["protocol"] == 6)
    x["udp_frac"] = m(f["protocol"] == 17)
    x["no_reply_frac"] = m(f["bwd_pkts"] <= 0)
    x["short_flow_frac"] = m(f["duration_us"] < 1000)
    x["mean_log_pkt_len"] = m(np.log1p(f["pkt_len_mean"].clip(lower=0)))
    x["mean_log_init_win_fwd"] = m(np.log1p(f["init_win_fwd"].clip(lower=0)))
    x["mean_log_init_win_bwd"] = m(np.log1p(f["init_win_bwd"].clip(lower=0)))
    x["top_src_share"] = top_share("src_ip")
    x["top_dst_share"] = top_share("dst_ip")
    x["log_max_src_port_fanout"] = fanout("dst_port")
    x["log_max_src_host_fanout"] = fanout("dst_ip")
    x["wellknown_port_frac"] = m(f["dst_port"] < 1024)
    x["outbound_frac"] = m(f["direction"] == 1) if "direction" in f else 0.0
    x["external_peer_frac"] = m(~f["peer_internal"]) if "peer_internal" in f else 0.0
    return x[FEATURE_NAMES]


def parse_networks(spec: str | list[str]) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    items = spec.split(",") if isinstance(spec, str) else spec
    return [ipaddress.ip_network(i.strip(), strict=False) for i in items if i.strip()]


def _internal_lookup(ips: pd.Series, networks) -> pd.Series:
    """Map each distinct IP string -> is it a usable internal host address."""
    uniq = pd.unique(ips)
    out = {}
    for ip in uniq:
        try:
            a = ipaddress.ip_address(ip)
        except ValueError:
            out[ip] = False
            continue
        out[ip] = any(
            a in n and a != n.broadcast_address and a != n.network_address and not a.is_multicast
            for n in networks
        )
    return ips.map(out)


def entity_flows(flows: pd.DataFrame, networks, window_seconds: int = 60) -> pd.DataFrame:
    """Explode flows to one row per internal endpoint ("entity").

    A flow between two internal hosts contributes to both. Adds columns
    entity, direction (1 = entity initiated), peer_internal, w (window start).
    """
    src_int = _internal_lookup(flows["src_ip"], networks)
    dst_int = _internal_lookup(flows["dst_ip"], networks)
    w = flows["timestamp"].dt.floor(f"{window_seconds}s")
    parts = []
    for mask, own, other, direction in ((src_int, "src_ip", dst_int, 1), (dst_int, "dst_ip", src_int, 0)):
        # assign masked values (not full-length Series): pandas would otherwise
        # re-index an empty selection and fabricate NaN rows
        sel = flows.loc[mask]
        parts.append(sel.assign(entity=sel[own].to_numpy(), direction=direction,
                                peer_internal=other[mask].to_numpy(), w=w[mask].to_numpy()))
    return pd.concat(parts, ignore_index=True)


def _reindex_entities(frame: pd.DataFrame, window_seconds: int, fill: float = 0.0) -> pd.DataFrame:
    """Make each entity's window sequence contiguous over the capture span."""
    windows = frame.index.get_level_values(1)
    full = pd.date_range(windows.min(), windows.max(), freq=f"{window_seconds}s")
    idx = pd.MultiIndex.from_product([frame.index.get_level_values(0).unique(), full], names=["entity", "window_start"])
    return frame.reindex(idx).fillna(fill)


def entity_window_features(ef: pd.DataFrame, window_seconds: int = 60) -> pd.DataFrame:
    """Feature matrix indexed by (entity, window_start)."""
    if ef.empty:
        return pd.DataFrame(columns=FEATURE_NAMES)
    x = _aggregate(ef, ["entity", "w"])
    x.index = x.index.set_names(["entity", "window_start"])
    return _reindex_entities(x, window_seconds).astype(np.float32)


def entity_raw_stats(ef: pd.DataFrame, window_seconds: int = 60) -> pd.DataFrame:
    """Plain-unit per-(entity, window) statistics for display."""
    g = ef.groupby(["entity", "w"], sort=True)
    stats = pd.DataFrame({
        "flows": g.size(),
        "packets": g["total_pkts"].sum() if "total_pkts" in ef else g["fwd_pkts"].sum() + g["bwd_pkts"].sum(),
        "bytes": g["fwd_bytes"].sum() + g["bwd_bytes"].sum(),
        "unique_peers": ef.assign(peer=np.where(ef["direction"] == 1, ef["dst_ip"], ef["src_ip"])).groupby(["entity", "w"])["peer"].nunique(),
        "unique_dst_ports": g["dst_port"].nunique(),
        "syn_flags": g["syn"].sum() if "syn" in ef else 0,
    })
    stats.index = stats.index.set_names(["entity", "window_start"])
    return _reindex_entities(stats, window_seconds).astype(np.int64)


def entity_window_states(ef: pd.DataFrame, window_seconds: int = 60, min_attack_flows: int = 2) -> pd.DataFrame:
    """Ground-truth state per (entity, window) from flow labels (training/eval only).

    The state is the attack state with the most labelled flows touching the
    entity in the window, provided it has at least `min_attack_flows`;
    otherwise NORMAL. Per-state flow counts are kept for auditing.
    """
    states = ef["label"].map(map_label)
    unknown = ef.loc[states.isna(), "label"].unique().tolist()
    if unknown:
        raise ValueError(f"unmapped labels: {unknown}")
    counts = (
        pd.DataFrame({"entity": ef["entity"], "w": ef["w"], "s": states.astype(int)})
        .groupby(["entity", "w", "s"]).size().unstack(fill_value=0)
        .reindex(columns=range(NUM_STATES), fill_value=0)
    )
    attack = counts.drop(columns=[int(AttackState.NORMAL)])
    top = attack.idxmax(axis=1)
    state = np.where(attack.max(axis=1) >= min_attack_flows, top, int(AttackState.NORMAL))
    out = pd.DataFrame({"state": state.astype(np.int64)}, index=counts.index)
    out[[f"n_{i}" for i in range(NUM_STATES)]] = counts.to_numpy()
    out.index = out.index.set_names(["entity", "window_start"])
    return _reindex_entities(out, window_seconds).astype(np.int64)


# --------------------------------------------------------------------------
# Portable feature set: computable from ANY flow record that has timestamp,
# endpoints, destination port, protocol, duration, total packets and bytes per
# direction (CICFlowMeter, UNSW-NB15/Argus, CTU-13 binetflow, NetFlow/IPFIX,
# or flows built from PCAP). Used for multi-dataset training.

PORTABLE_FEATURE_NAMES: list[str] = [
    "log_flows", "log_total_pkts", "log_fwd_bytes", "log_bwd_bytes", "log_bwd_fwd_byte_ratio",
    "mean_log_duration", "std_log_duration", "mean_log_bytes_per_pkt", "no_reply_frac", "short_flow_frac",
    "tcp_frac", "udp_frac", "icmp_frac", "log_uniq_src_ip", "log_uniq_dst_ip", "log_uniq_dst_port",
    "dst_port_entropy", "src_ip_entropy", "dst_ip_entropy", "top_src_share", "top_dst_share",
    "log_max_src_port_fanout", "log_max_src_host_fanout", "wellknown_port_frac", "outbound_frac",
    "external_peer_frac",
]
PORTABLE_DESCRIPTIONS: dict[str, str] = {
    **{k: v for k, v in FEATURE_DESCRIPTIONS.items() if k in PORTABLE_FEATURE_NAMES},
    "log_total_pkts": "packets (both directions)",
    "log_bwd_fwd_byte_ratio": "reply/request byte ratio",
    "mean_log_bytes_per_pkt": "bytes per packet",
    "no_reply_frac": "share of flows with no reply bytes",
    "icmp_frac": "share of ICMP flows",
}
PORTABLE_REQUIRED = ["timestamp", "src_ip", "dst_ip", "dst_port", "protocol", "duration_us",
                     "total_pkts", "fwd_bytes", "bwd_bytes"]


def portable_window_features(ef: pd.DataFrame, window_seconds: int = 60) -> pd.DataFrame:
    """Portable feature matrix indexed by (entity, window_start)."""
    if ef.empty:
        return pd.DataFrame(columns=PORTABLE_FEATURE_NAMES)
    f = ef
    keys = ["entity", "w"]
    kser = [f[k] for k in keys]
    g = f.groupby(keys, sort=True)
    n = g.size().astype(float)

    def s(col):
        return g[col].sum()

    def m(values):
        return pd.Series(np.asarray(values, dtype=float), index=f.index).groupby(kser).mean()

    lvl = [0, 1]
    pk = f["total_pkts"].clip(lower=0)
    byt = f["fwd_bytes"].clip(lower=0) + f["bwd_bytes"].clip(lower=0)
    log_dur = pd.Series(np.log1p(f["duration_us"].clip(lower=0)).values, index=f.index)
    x = pd.DataFrame(index=n.index)
    x["log_flows"] = np.log1p(n)
    x["log_total_pkts"] = np.log1p(s("total_pkts").clip(lower=0))
    x["log_fwd_bytes"] = np.log1p(s("fwd_bytes").clip(lower=0))
    x["log_bwd_bytes"] = np.log1p(s("bwd_bytes").clip(lower=0))
    x["log_bwd_fwd_byte_ratio"] = np.log((s("bwd_bytes").clip(lower=0) + 1) / (s("fwd_bytes").clip(lower=0) + 1))
    x["mean_log_duration"] = log_dur.groupby(kser).mean()
    x["std_log_duration"] = log_dur.groupby(kser).std(ddof=0)
    x["mean_log_bytes_per_pkt"] = m(np.log1p(byt / pk.where(pk > 0, 1)))
    x["no_reply_frac"] = m(f["bwd_bytes"] <= 0)
    x["short_flow_frac"] = m(f["duration_us"] < 1000)
    x["tcp_frac"] = m(f["protocol"] == 6)
    x["udp_frac"] = m(f["protocol"] == 17)
    x["icmp_frac"] = m(f["protocol"] == 1)
    x["log_uniq_src_ip"] = np.log1p(g["src_ip"].nunique())
    x["log_uniq_dst_ip"] = np.log1p(g["dst_ip"].nunique())
    x["log_uniq_dst_port"] = np.log1p(g["dst_port"].nunique())
    x["dst_port_entropy"] = _entropy(kser, f["dst_port"])
    x["src_ip_entropy"] = _entropy(kser, f["src_ip"])
    x["dst_ip_entropy"] = _entropy(kser, f["dst_ip"])
    x["top_src_share"] = f.groupby([*keys, "src_ip"]).size().groupby(level=lvl).max() / n
    x["top_dst_share"] = f.groupby([*keys, "dst_ip"]).size().groupby(level=lvl).max() / n
    x["log_max_src_port_fanout"] = np.log1p(f.groupby([*keys, "src_ip"])["dst_port"].nunique().groupby(level=lvl).max())
    x["log_max_src_host_fanout"] = np.log1p(f.groupby([*keys, "src_ip"])["dst_ip"].nunique().groupby(level=lvl).max())
    x["wellknown_port_frac"] = m(f["dst_port"] < 1024)
    x["outbound_frac"] = m(f["direction"] == 1)
    x["external_peer_frac"] = m(~f["peer_internal"].astype(bool))
    x.index = x.index.set_names(["entity", "window_start"])
    return _reindex_entities(x[PORTABLE_FEATURE_NAMES], window_seconds).astype(np.float32)


def window_states_from(ef: pd.DataFrame, state_col: str = "state", window_seconds: int = 60,
                       min_attack_flows: int = 2) -> pd.DataFrame:
    """Like entity_window_states, but from an integer per-flow state column."""
    counts = (
        pd.DataFrame({"entity": ef["entity"], "w": ef["w"], "s": ef[state_col].astype(int)})
        .groupby(["entity", "w", "s"]).size().unstack(fill_value=0)
        .reindex(columns=range(NUM_STATES), fill_value=0)
    )
    attack = counts.drop(columns=[int(AttackState.NORMAL)])
    top = attack.idxmax(axis=1)
    state = np.where(attack.max(axis=1) >= min_attack_flows, top, int(AttackState.NORMAL))
    out = pd.DataFrame({"state": state.astype(np.int64)}, index=counts.index)
    out.index = out.index.set_names(["entity", "window_start"])
    return _reindex_entities(out, window_seconds).astype(np.int64)
