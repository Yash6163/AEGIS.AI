import gzip
import struct

import pandas as pd
import pytest

from aegis.ingestion.formats import detect, to_canonical
from aegis.ingestion.pcap import PcapError, read_pcap_flows


def _ip(a):
    return bytes(int(x) for x in a.split("."))


def tcp_packet(src, dst, sport, dport, flags, ttl=64, win=29200, payload=b""):
    tcp = struct.pack(">HHIIBBHHH", sport, dport, 0, 0, 5 << 4, flags, win, 0, 0) + payload
    ip = struct.pack(">BBHHHBBH4s4s", 0x45, 0, 20 + len(tcp), 0, 0, ttl, 6, 0, _ip(src), _ip(dst)) + tcp
    return b"\x00" * 12 + b"\x08\x00" + ip


def write_pcap(path, packets, gz=False):
    out = struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
    for ts, pkt in packets:
        out += struct.pack("<IIII", int(ts), int((ts % 1) * 1e6), len(pkt), len(pkt)) + pkt
    with (gzip.open if gz else open)(path, "wb") as fh:
        fh.write(out)


def test_bidirectional_flow_assembly(tmp_path):
    c, s = "192.168.1.10", "10.0.0.5"
    pkts = [
        (1000.0, tcp_packet(c, s, 40000, 80, 0x02, ttl=64, win=1000)),            # SYN
        (1000.1, tcp_packet(s, c, 80, 40000, 0x12, ttl=128, win=2000)),           # SYN-ACK
        (1000.2, tcp_packet(c, s, 40000, 80, 0x18, payload=b"x" * 100)),          # PSH-ACK data
        (1000.5, tcp_packet(s, c, 80, 40000, 0x11, ttl=128, win=2000)),           # FIN-ACK
        (1500.0, tcp_packet(c, s, 40000, 80, 0x02)),                              # after idle timeout -> new flow
    ]
    p = tmp_path / "t.pcap.gz"
    write_pcap(p, pkts, gz=True)
    df, st = read_pcap_flows(p, idle_timeout=120)
    assert st["packets"] == 5 and st["flows"] == 2
    f = df.iloc[0]
    assert (f.src_ip, f.dst_ip, f.src_port, f.dst_port, f.protocol) == (c, s, 40000, 80, 6)
    assert (f.fwd_pkts, f.bwd_pkts, f.fwd_bytes, f.bwd_bytes) == (2, 2, 100, 0)
    assert (f.syn, f.fin, f.psh, f.ack, f.rst) == (1, 1, 1, 1, 0)
    assert (f.init_win_fwd, f.init_win_bwd) == (1000, 2000)
    assert f.ttl_fwd_mean == 64 and abs(f.duration_us - 500_000) < 1
    assert abs(f.iat_max - 300_000) < 1


@pytest.mark.parametrize("head,msg", [(b"\x0a\x0d\x0d\x0a" + b"\x00" * 28, "pcapng"), (b"GARBAGE!" * 4, "magic"), (b"ab", "short")])
def test_bad_captures_rejected(tmp_path, head, msg):
    p = tmp_path / "bad.pcap"
    p.write_bytes(head)
    with pytest.raises(PcapError, match=msg):
        read_pcap_flows(p)


def test_packet_limit(tmp_path):
    p = tmp_path / "t.pcap"
    write_pcap(p, [(1.0 + i, tcp_packet("10.0.0.1", "10.0.0.2", 1, 2, 0x10)) for i in range(5)])
    with pytest.raises(PcapError, match="more than"):
        read_pcap_flows(p, max_packets=3)


def test_binetflow_and_unsw_detection():
    b = pd.DataFrame({"StartTime": ["2011/08/10 09:46:53.047277"], "Dur": ["1.5"], "Proto": ["tcp"], "SrcAddr": ["147.32.84.165"],
                      "Sport": ["0x0303"], "Dir": ["->"], "DstAddr": ["8.8.8.8"], "Dport": ["53"], "TotPkts": ["4"],
                      "TotBytes": ["500"], "SrcBytes": ["200"], "Label": ["flow=From-Botnet-V42-TCP-CC6"]})
    assert detect(list(b.columns)) == "binetflow"
    f, profile, _ = to_canonical(b)
    assert profile == "binetflow"
    assert (f.src_port[0], f.protocol[0], f.fwd_bytes[0], f.bwd_bytes[0], f.total_pkts[0]) == (0x303, 6, 200, 300, 4)
    u = pd.DataFrame({"srcip": ["175.45.176.1"], "sport": [1043], "dstip": ["149.171.126.18"], "dsport": [80], "proto": ["tcp"],
                      "dur": [0.2], "sbytes": [300], "dbytes": [900], "Spkts": [4], "Dpkts": [3], "Stime": [1421927414],
                      "sttl": [254], "dttl": [252], "attack_cat": ["Exploits"]})
    f, profile, _ = to_canonical(u)
    assert profile == "unsw" and f.total_pkts[0] == 7 and f.ttl_fwd_mean[0] == 254 and f.label[0] == "Exploits"
