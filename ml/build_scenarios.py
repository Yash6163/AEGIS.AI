"""Stage 4: package the per-host window features as replay scenarios.

Output: data/scenarios/cicids2017_replay.npz  (numeric arrays, loaded with
        allow_pickle=False) and cicids2017_replay.json (index/metadata).

Each capture day becomes one scenario. Ground-truth states are included only
so the UI can show "what actually happened next" beside the forecast; they
are never fed to the model. The CV fold of each minute is included so the
replay can use the cross-validation model that never saw that time block.

Usage: python ml/build_scenarios.py
"""

from __future__ import annotations

import itertools
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "ml"))

import data as D  # noqa: E402

from aegis.forecasting.features import FEATURE_NAMES  # noqa: E402
from aegis.forecasting.states import STATE_NAMES  # noqa: E402

STAT_COLUMNS = ["flows", "packets", "bytes", "unique_peers", "unique_dst_ports", "syn_flags"]
DESCRIPTIONS = {
    "monday": "Benign traffic only - use it to see the false-alarm behaviour.",
    "tuesday": "FTP-Patator then SSH-Patator brute force against the web server.",
    "wednesday": "Staged DoS campaign (slowloris, slowhttptest, Hulk, GoldenEye) and Heartbleed.",
    "thursday": "Web brute force -> XSS -> SQL injection; afternoon infiltration of a workstation.",
    "friday": "ARES botnet C2 beaconing, nmap port scans, then a LOIT DDoS.",
}
HOST_ROLES = {  # documented roles from the CIC-IDS2017 testbed description
    "192.168.10.50": "Ubuntu web server (main attack target)",
    "192.168.10.51": "Ubuntu server (Heartbleed target)",
    "192.168.10.3": "Windows Server (DC / DNS)",
    "192.168.10.1": "Gateway / firewall",
}


def main() -> None:
    windows = D.load_windows()
    out = ROOT / "data" / "scenarios"
    out.mkdir(parents=True, exist_ok=True)
    arrays, index = {}, []
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
        g = windows[windows["day"] == day]
        entities = sorted(g["entity"].unique())
        times = np.sort(g["window_start"].unique())
        T, E = len(times), len(entities)
        g = g.set_index(["entity", "window_start"]).reindex(
            [(e, t) for e in entities for t in times]
        )
        feats = g[FEATURE_NAMES].to_numpy(np.float32).reshape(E, T, -1)
        states = g["state"].to_numpy().reshape(E, T).astype(np.int8)
        stats = g[STAT_COLUMNS].to_numpy().reshape(E, T, -1).astype(np.int64)
        fold = g["fold"].to_numpy().reshape(E, T)[0].astype(np.int8)
        arrays[f"{day}__features"] = feats
        arrays[f"{day}__states"] = states
        arrays[f"{day}__stats"] = stats
        arrays[f"{day}__fold"] = fold
        episodes = []
        for e_i, e in enumerate(entities):
            t = 0
            for s, run in itertools.groupby(states[e_i].tolist()):
                n = len(list(run))
                if s != 0:
                    episodes.append({"host": e, "state": STATE_NAMES[s], "start_index": t, "minutes": n})
                t += n
        start = str(np.datetime_as_string(times[0], unit="s"))
        index.append({
            "id": f"cicids2017-{day}",
            "day": day,
            "title": f"CIC-IDS2017 {day.capitalize()} ({start[:10]})",
            "description": DESCRIPTIONS[day],
            "start": start + "Z",
            "window_seconds": 60,
            "n_windows": T,
            "hosts": [{"host": e, "role": HOST_ROLES.get(e)} for e in entities],
            "attack_minutes": {STATE_NAMES[s]: int((states == s).any(0).sum()) for s in range(1, len(STATE_NAMES))},
            "episodes": episodes,
        })
        print(f"{day}: {E} hosts x {T} minutes, {len(episodes)} host attack episodes")
    np.savez_compressed(out / "cicids2017_replay.npz", **arrays)
    (out / "cicids2017_replay.json").write_text(json.dumps({
        "dataset": "CIC-IDS2017 (Canadian Institute for Cybersecurity), GeneratedLabelledFlows",
        "citation": "Sharafaldin, Lashkari, Ghorbani. Toward Generating a New Intrusion Detection Dataset and "
                    "Intrusion Traffic Characterization. ICISSP 2018.",
        "features": FEATURE_NAMES, "stat_columns": STAT_COLUMNS, "states": STATE_NAMES,
        "note": "Timestamps are UTC (local testbed time + 3 h). Ground-truth states are for display/evaluation only.",
        "scenarios": index,
    }, indent=1))
    print("size MB", round((out / "cicids2017_replay.npz").stat().st_size / 1e6, 2))


if __name__ == "__main__":
    main()
