"""Scenario replay: per-minute snapshots and host forecasts over recorded data."""

from __future__ import annotations

from ..forecasting.states import STATE_NAMES
from .registry import Registry

SNAPSHOT_SAMPLES = 256


def network_summary(hosts: list[dict]) -> dict:
    """Network view = worst host. Probabilities are NOT combined across hosts
    (they are not independent), we report the maximum and the count."""
    top = max(hosts, key=lambda h: (h["risk_score"], h["attack_probability"]))
    return {
        "risk_score": top["risk_score"],
        "risk_level": top["risk_level"],
        "highest_risk_host": top["host"],
        "max_attack_probability": max(h["attack_probability"] for h in hosts),
        "max_compromise_probability": max(h["compromise_probability"] for h in hosts),
        "hosts_warning": sum(1 for h in hosts if h["warning"]),
        "hosts_in_attack_state": sum(1 for h in hosts if h["current_state"] != "NORMAL"),
        "hosts_total": len(hosts),
    }


def snapshot(reg: Registry, scenario_id: str, t: int, use_cv: bool = True) -> dict:
    store = reg.scenarios
    assert store is not None
    n = store.n_windows(scenario_id)
    if not 0 <= t < n:
        raise IndexError(f"t must be in [0, {n - 1}]")
    engine, mode = reg.engine_for_replay(store.fold(scenario_id, t), use_cv)
    hist, pad = store.histories(scenario_id, t, engine.rt.history)
    summaries = engine.summarise(hist, n_samples=SNAPSHOT_SAMPLES, seed=t)
    truth = store.truth(scenario_id, t, 0)[:, 0]
    stats = store.stats(scenario_id, t)
    meta = store.get(scenario_id)
    hosts = []
    for i, (h, s) in enumerate(zip(meta["hosts"], summaries, strict=False)):
        hosts.append({
            "host": h["host"], "role": h["role"], **s,
            "truth_state": STATE_NAMES[int(truth[i])],
            "stats": dict(zip(store.stat_columns, map(int, stats[i]), strict=False)),
        })
    return {
        "scenario": scenario_id, "t": t, "n_windows": n,
        "window_start": store.window_start(scenario_id, t).isoformat(),
        "model": {"version": engine.version, "mode": mode, "fold": store.fold(scenario_id, t)},
        "early_warning": {"horizon": engine.warning_horizon, "threshold": engine.warning_threshold},
        "history_padded": pad,
        "hosts": hosts,
        "network": network_summary(hosts),
        "data_label": "Recorded CIC-IDS2017 traffic replayed as a simulation - not a live network feed",
    }


def host_forecast(reg: Registry, scenario_id: str, host: str, t: int, horizon: int, use_cv: bool = True,
                  n_samples: int = 512) -> dict:
    store = reg.scenarios
    assert store is not None
    n = store.n_windows(scenario_id)
    if not 0 <= t < n:
        raise IndexError(f"t must be in [0, {n - 1}]")
    i = store.host_index(scenario_id, host)
    engine, mode = reg.engine_for_replay(store.fold(scenario_id, t), use_cv)
    hist, pad = store.histories(scenario_id, t, engine.rt.history)
    fc = engine.forecast(hist[i], horizon=horizon, n_samples=n_samples, seed=t)
    truth = store.truth(scenario_id, t, horizon)[i]
    fc["history_padded"] = pad
    fc["context"] = {
        "source": "replay", "scenario": scenario_id, "host": host, "t": t,
        "window_start": store.window_start(scenario_id, t).isoformat(),
        "model_mode": mode, "fold": store.fold(scenario_id, t),
    }
    # Ground truth is attached for comparison only; it was not an input.
    fc["ground_truth"] = {
        "states": [STATE_NAMES[int(s)] for s in truth],
        "available_steps": int(len(truth)),
        "note": "dataset labels, shown for evaluation; never used as model input",
    }
    return fc
