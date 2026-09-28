"""PCAP -> bidirectional flow table (pure Python, no native parsers).

Reads classic libpcap files (Ethernet or raw-IP link types, optional 802.1Q
tag), IPv4 TCP/UDP/ICMP. Packets are grouped into bidirectional flows keyed
by the 5-tuple; the first packet's sender is the flow's forward direction.
A flow ends after `idle_timeout` seconds without packets or when it has been
active for `active_timeout` seconds (CICFlowMeter uses 120 s / 1800 s-style
timeouts; values here are the same defaults).

Output columns match the canonical flow schema used by features.py, plus
packet-level aggregates the flow CSVs do not carry:
    ttl_fwd_mean, ttl_fwd_std, payload_mean
Flag columns follow CICFlowMeter's semantics (1 if any packet carried it).

pcapng is not supported (reject and convert with `editcap -F libpcap`).
Work is bounded by `max_packets`; the parser only reads fixed-size headers
and never interprets payloads.
"""

from __future__ import annotations

import gzip
import math
import struct
from pathlib import Path
from typing import BinaryIO

import pandas as pd

MAGIC = {
    b"\xd4\xc3\xb2\xa1": ("<", 1e-6), b"\xa1\xb2\xc3\xd4": (">", 1e-6),
    b"\x4d\x3c\xb2\xa1": ("<", 1e-9), b"\xa1\xb2\x3c\x4d": (">", 1e-9),
}
LINK_ETHERNET, LINK_RAW, LINK_RAW_ALT = 1, 101, 12
FIN, SYN, RST, PSH, ACK, URG = 0x01, 0x02, 0x04, 0x08, 0x10, 0x20


class PcapError(ValueError):
    pass


class _Flow:
    __slots__ = ("key", "src", "dst", "sport", "dport", "proto", "start", "last", "fp", "bp", "fb", "bb",
                 "n", "iat_sum", "iat_sq", "iat_max", "flags", "win_f", "win_b", "ttl_n", "ttl_s", "ttl_q", "pay_s")

    def __init__(self, key, src, dst, sport, dport, proto, ts):
        self.key, self.src, self.dst, self.sport, self.dport, self.proto = key, src, dst, sport, dport, proto
        self.start = self.last = ts
        self.fp = self.bp = self.fb = self.bb = self.n = 0
        self.iat_sum = self.iat_sq = self.iat_max = 0.0
        self.flags = 0
        self.win_f = self.win_b = -1
        self.ttl_n = 0
        self.ttl_s = self.ttl_q = 0.0
        self.pay_s = 0

    def row(self) -> tuple:
        n_iat = max(self.n - 1, 0)
        mean = self.iat_sum / n_iat if n_iat else 0.0
        var = max(self.iat_sq / n_iat - mean * mean, 0.0) if n_iat else 0.0
        tm = self.ttl_s / self.ttl_n if self.ttl_n else 0.0
        tv = max(self.ttl_q / self.ttl_n - tm * tm, 0.0) if self.ttl_n else 0.0
        f = self.flags
        return (
            self.start, self.src, self.dst, self.sport, self.dport, self.proto,
            (self.last - self.start) * 1e6, self.fp, self.bp, self.fb, self.bb,
            mean * 1e6, math.sqrt(var) * 1e6, self.iat_max * 1e6,
            int(bool(f & SYN)), int(bool(f & FIN)), int(bool(f & RST)), int(bool(f & PSH)),
            int(bool(f & ACK)), int(bool(f & URG)),
            self.pay_s / self.n if self.n else 0.0, self.win_f, self.win_b,
            tm, math.sqrt(tv), self.pay_s / self.n if self.n else 0.0,
        )


COLUMNS = ["timestamp", "src_ip", "dst_ip", "src_port", "dst_port", "protocol", "duration_us",
           "fwd_pkts", "bwd_pkts", "fwd_bytes", "bwd_bytes", "iat_mean", "iat_std", "iat_max",
           "syn", "fin", "rst", "psh", "ack", "urg", "pkt_len_mean", "init_win_fwd", "init_win_bwd",
           "ttl_fwd_mean", "ttl_fwd_std", "payload_mean"]


def _open(path: Path) -> BinaryIO:
    with open(path, "rb") as fh:
        gz = fh.read(2) == b"\x1f\x8b"
    return gzip.open(path, "rb") if gz else open(path, "rb")


def read_pcap_flows(path: str | Path, idle_timeout: float = 120.0, active_timeout: float = 1800.0,
                    max_packets: int = 20_000_000) -> tuple[pd.DataFrame, dict]:
    """Parse a (optionally gzipped) libpcap file into the canonical flow table."""
    stats = {"packets": 0, "ipv4": 0, "skipped": 0, "truncated": False}
    active: dict[tuple, _Flow] = {}
    done: list[tuple] = []
    with _open(Path(path)) as fh:
        head = fh.read(24)
        if len(head) < 24:
            raise PcapError("file too short to be a pcap")
        if head[:4] == b"\x0a\x0d\x0d\x0a":
            raise PcapError("pcapng is not supported; convert with `editcap -F libpcap in.pcapng out.pcap`")
        if head[:4] not in MAGIC:
            raise PcapError("not a libpcap file (bad magic number)")
        endian, tres = MAGIC[head[:4]]
        linktype = struct.unpack(endian + "I", head[20:24])[0]
        if linktype not in (LINK_ETHERNET, LINK_RAW, LINK_RAW_ALT):
            raise PcapError(f"unsupported link type {linktype} (Ethernet or raw IP only)")
        rec = struct.Struct(endian + "IIII")
        last_sweep = None
        while True:
            h = fh.read(16)
            if len(h) < 16:
                break
            ts_s, ts_frac, incl, _orig = rec.unpack(h)
            if incl > 262144:
                raise PcapError("corrupt packet record (length > 256 KiB)")
            data = fh.read(incl)
            if len(data) < incl:
                stats["truncated"] = True
                break
            stats["packets"] += 1
            if stats["packets"] > max_packets:
                raise PcapError(f"more than {max_packets:,} packets")
            ts = ts_s + ts_frac * tres
            off = 0
            if linktype == LINK_ETHERNET:
                if len(data) < 14:
                    stats["skipped"] += 1
                    continue
                etype = int.from_bytes(data[12:14], "big")
                off = 14
                if etype == 0x8100 and len(data) >= 18:
                    etype = int.from_bytes(data[16:18], "big")
                    off = 18
                if etype != 0x0800:
                    stats["skipped"] += 1
                    continue
            if len(data) < off + 20 or data[off] >> 4 != 4:
                stats["skipped"] += 1
                continue
            ihl = (data[off] & 0x0F) * 4
            total_len = int.from_bytes(data[off + 2:off + 4], "big")
            ttl, proto = data[off + 8], data[off + 9]
            src = ".".join(map(str, data[off + 12:off + 16]))
            dst = ".".join(map(str, data[off + 16:off + 20]))
            l4 = off + ihl
            sport = dport = 0
            flags = 0
            win = -1
            hdr = 0
            if proto == 6 and len(data) >= l4 + 20:
                sport, dport = struct.unpack(">HH", data[l4:l4 + 4])
                hdr = (data[l4 + 12] >> 4) * 4
                flags = data[l4 + 13]
                win = int.from_bytes(data[l4 + 14:l4 + 16], "big")
            elif proto == 17 and len(data) >= l4 + 8:
                sport, dport = struct.unpack(">HH", data[l4:l4 + 4])
                hdr = 8
            elif proto == 1:
                hdr = 8
            payload = max(total_len - ihl - hdr, 0)
            stats["ipv4"] += 1

            fwd_key = (proto, src, sport, dst, dport)
            rev_key = (proto, dst, dport, src, sport)
            f = active.get(fwd_key)
            forward = True
            if f is None:
                f = active.get(rev_key)
                forward = False
            if f is not None and (ts - f.last > idle_timeout or ts - f.start > active_timeout):
                done.append(f.row())
                del active[f.key]
                f = None
            if f is None:
                f = _Flow(fwd_key, src, dst, sport, dport, proto, ts)
                active[fwd_key] = f
                forward = True
            if f.n:
                iat = ts - f.last
                f.iat_sum += iat
                f.iat_sq += iat * iat
                if iat > f.iat_max:
                    f.iat_max = iat
            f.last = ts
            f.n += 1
            f.flags |= flags
            f.pay_s += payload
            if forward:
                f.fp += 1
                f.fb += payload
                f.ttl_n += 1
                f.ttl_s += ttl
                f.ttl_q += ttl * ttl
                if f.win_f < 0 and win >= 0:
                    f.win_f = win
            else:
                f.bp += 1
                f.bb += payload
                if f.win_b < 0 and win >= 0:
                    f.win_b = win
            # periodically retire idle flows to bound memory
            if last_sweep is None:
                last_sweep = ts
            elif ts - last_sweep > idle_timeout:
                for k in [k for k, v in active.items() if ts - v.last > idle_timeout]:
                    done.append(active.pop(k).row())
                last_sweep = ts
    done.extend(f.row() for f in active.values())
    df = pd.DataFrame(done, columns=COLUMNS)
    if not df.empty:
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="s")
        df = df.sort_values("timestamp", kind="stable").reset_index(drop=True)
    stats["flows"] = len(df)
    return df, stats
