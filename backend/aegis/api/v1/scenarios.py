"""Replay of recorded CIC-IDS2017 days (clearly labelled simulation)."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from ...config import Settings
from ...db.session import session_scope
from ...ingestion.sources import ScenarioNotFound
from ...services import alerts as alert_svc
from ...services import replay
from ...services.registry import Registry
from ..deps import require_api_key, scenarios_registry, settings_dep

router = APIRouter(prefix="/scenarios", tags=["replay"])
log = logging.getLogger("aegis.replay")
MAX_STREAM_WINDOWS = 600


def _guard(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ScenarioNotFound as exc:
        raise HTTPException(404, f"not found: {exc}") from exc
    except IndexError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("", summary="List replay scenarios")
def list_scenarios(reg: Registry = Depends(scenarios_registry)) -> dict:
    store = reg.scenarios
    return {
        "dataset": store.meta["dataset"], "citation": store.meta["citation"], "note": store.meta["note"],
        "data_label": "Recorded dataset traffic replayed as a simulation - not a live network feed",
        "scenarios": [{k: v for k, v in s.items() if k != "episodes"} for s in store.meta["scenarios"]],
    }


@router.get("/{scenario_id}", summary="Scenario metadata, ground-truth episodes and traffic timeline")
def get_scenario(scenario_id: str, reg: Registry = Depends(scenarios_registry)) -> dict:
    meta = _guard(reg.scenarios.get, scenario_id)
    return {**meta, "timeline": reg.scenarios.timeline(scenario_id)}


@router.get("/{scenario_id}/snapshot", summary="All hosts at minute t: nowcast, forecast summary, risk")
def get_snapshot(scenario_id: str, t: int = Query(ge=0), cv: bool = True,
                 reg: Registry = Depends(scenarios_registry)) -> dict:
    return _guard(replay.snapshot, reg, scenario_id, t, cv)


@router.get("/{scenario_id}/forecast", summary="Full K-step forecast + explanation for one host at minute t")
def get_host_forecast(scenario_id: str, host: str = Query(max_length=64), t: int = Query(ge=0),
                      horizon: int = Query(5, ge=1, le=10), cv: bool = True,
                      reg: Registry = Depends(scenarios_registry), settings: Settings = Depends(settings_dep)) -> dict:
    return _guard(replay.host_forecast, reg, scenario_id, host, t, horizon, cv, settings.mc_samples)


@router.get("/{scenario_id}/stream", summary="Server-Sent Events: replay minute by minute")
async def stream(request: Request, scenario_id: str, start: int = Query(0, ge=0),
                 interval_ms: int = Query(1000, ge=200, le=10_000), cv: bool = True,
                 raise_alerts: bool = True, reg: Registry = Depends(scenarios_registry),
                 settings: Settings = Depends(settings_dep),
                 x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> StreamingResponse:
    """Emits `snapshot` events (one per recorded minute) and `alert` events when
    a host enters the alerting condition. Pipeline: ReplaySource -> buffer of
    the last L windows -> inference -> risk -> alert engine -> SSE."""
    if raise_alerts:  # persisting alerts is a write: same auth as other mutations
        require_api_key(x_api_key, settings)
    n = _guard(reg.scenarios.n_windows, scenario_id)
    if start >= n:
        raise HTTPException(422, f"start must be < {n}")

    async def events():
        gate = alert_svc.AlertGate()
        stop = min(n, start + MAX_STREAM_WINDOWS)
        for t in range(start, stop):
            if await request.is_disconnected():
                break
            snap = await run_in_threadpool(replay.snapshot, reg, scenario_id, t, cv)
            yield f"event: snapshot\ndata: {json.dumps(snap, default=str)}\n\n"
            if raise_alerts:
                for h in snap["hosts"]:
                    if gate.should_alert(h["host"], t, h):
                        alert = await run_in_threadpool(_raise_alert, reg, settings, scenario_id, h["host"], t, h)
                        yield f"event: alert\ndata: {json.dumps(alert, default=str)}\n\n"
            await asyncio.sleep(interval_ms / 1000)
        yield "event: end\ndata: {}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _raise_alert(reg: Registry, settings: Settings, scenario_id: str, host: str, t: int, summary: dict) -> dict:
    fc = replay.host_forecast(reg, scenario_id, host, t, settings.default_horizon, True, settings.mc_samples)
    ws = reg.scenarios.window_start(scenario_id, t)
    with session_scope() as db:
        a = alert_svc.create_alert(db, source="replay", context=scenario_id, host=host, window_start=ws,
                                   forecast=fc, summary=summary)
        return {"id": a.id, "host": host, "level": a.level, "title": a.title, "t": t,
                "window_start": ws.isoformat(), "predicted_state": a.predicted_state,
                "attack_probability": a.attack_probability, "risk_score": a.risk_score}
