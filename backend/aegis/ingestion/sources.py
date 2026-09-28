"""Traffic sources.

The streaming pipeline consumes a `TrafficSource` that yields, per time
window, the feature vector of every monitored host:

    source -> WindowBatch -> temporal buffer (last L windows / host)
           -> inference -> risk -> alerts -> SSE

Only `ReplaySource` (recorded CIC-IDS2017 windows) is implemented. A live
NetFlow/IPFIX or PCAP source would implement the same interface by running
the flow table through `features.entity_flows` + `entity_window_features`
once per window; that source does NOT exist yet and nothing in the UI claims
live capture.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Protocol

import numpy as np

from ..forecasting.states import STATE_NAMES


@dataclass
class WindowBatch:
    index: int
    window_start: datetime
    hosts: list[str]
    features: np.ndarray  # (H, F) raw features of this window
    stats: np.ndarray | None = None  # (H, n_stats)
    truth: np.ndarray | None = None  # (H,) ground-truth state ids (replay only)


class TrafficSource(Protocol):
    kind: str

    def windows(self, start: int = 0) -> Iterator[WindowBatch]: ...


class ScenarioNotFound(KeyError):
    pass


class ScenarioStore:
    """Recorded per-host window features of the CIC-IDS2017 capture days."""

    def __init__(self, npz_path: str | Path):
        npz_path = Path(npz_path)
        meta = json.loads(npz_path.with_suffix(".json").read_text())
        with np.load(npz_path, allow_pickle=False) as z:
            self._arrays = {k: z[k] for k in z.files}
        self.meta = meta
        self.stat_columns: list[str] = meta["stat_columns"]
        self.scenarios = {s["id"]: s for s in meta["scenarios"]}

    def get(self, scenario_id: str) -> dict:
        if scenario_id not in self.scenarios:
            raise ScenarioNotFound(scenario_id)
        return self.scenarios[scenario_id]

    def _arr(self, scenario_id: str, name: str) -> np.ndarray:
        return self._arrays[f"{self.get(scenario_id)['day']}__{name}"]

    def hosts(self, scenario_id: str) -> list[str]:
        return [h["host"] for h in self.get(scenario_id)["hosts"]]

    def host_index(self, scenario_id: str, host: str) -> int:
        try:
            return self.hosts(scenario_id).index(host)
        except ValueError as exc:
            raise ScenarioNotFound(f"{scenario_id}/{host}") from exc

    def n_windows(self, scenario_id: str) -> int:
        return int(self.get(scenario_id)["n_windows"])

    def window_start(self, scenario_id: str, t: int) -> datetime:
        start = datetime.fromisoformat(self.get(scenario_id)["start"].replace("Z", "+00:00"))
        return start + timedelta(seconds=60 * t)

    def histories(self, scenario_id: str, t: int, history: int) -> tuple[np.ndarray, int]:
        """(H, L, F) raw features for all hosts ending at t, zero-padded at day start."""
        feats = self._arr(scenario_id, "features")
        lo = max(0, t - history + 1)
        h = feats[:, lo:t + 1].astype(np.float64)
        pad = history - h.shape[1]
        if pad:
            h = np.concatenate([np.zeros((h.shape[0], pad, h.shape[2])), h], axis=1)
        return h, pad

    def truth(self, scenario_id: str, t: int, horizon: int) -> np.ndarray:
        """(H, <=K+1) ground-truth states for t..t+K (display/evaluation only)."""
        return self._arr(scenario_id, "states")[:, t:t + horizon + 1].astype(int)

    def fold(self, scenario_id: str, t: int) -> int:
        return int(self._arr(scenario_id, "fold")[t])

    def stats(self, scenario_id: str, t: int) -> np.ndarray:
        return self._arr(scenario_id, "stats")[:, t]

    def timeline(self, scenario_id: str) -> dict:
        """Per-minute network totals and ground-truth attack state per host."""
        stats = self._arr(scenario_id, "stats")
        states = self._arr(scenario_id, "states")
        return {
            "flows": stats[:, :, self.stat_columns.index("flows")].sum(0).tolist(),
            "truth": [[STATE_NAMES[s] if s else None for s in row] for row in states.tolist()],
        }


class ReplaySource:
    """Replays a recorded scenario window by window (demo traffic, not live)."""

    kind = "replay"

    def __init__(self, store: ScenarioStore, scenario_id: str):
        self.store, self.scenario_id = store, scenario_id

    def windows(self, start: int = 0) -> Iterator[WindowBatch]:
        feats = self.store._arr(self.scenario_id, "features")
        for t in range(start, self.store.n_windows(self.scenario_id)):
            yield WindowBatch(
                index=t,
                window_start=self.store.window_start(self.scenario_id, t).astimezone(UTC),
                hosts=self.store.hosts(self.scenario_id),
                features=feats[:, t],
                stats=self.store.stats(self.scenario_id, t),
                truth=self.store.truth(self.scenario_id, t, 0)[:, 0],
            )
