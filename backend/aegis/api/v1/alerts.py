"""Alerts, audit chain and the dashboard aggregate."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...db.models import Alert, AnalysisJob, AuditEntry, Forecast
from ...db.session import get_db
from ...schemas.api import AlertOut, AlertPage, AlertUpdate, AuditEntryOut, JobOut
from ...services import alerts as alert_svc
from ...services import audit
from ...services.registry import Registry
from ..deps import registry_dep, require_api_key
from .analysis import job_counts

router = APIRouter(tags=["alerts"])

Level = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
Status = Literal["open", "acknowledged", "resolved"]


@router.get("/alerts", response_model=AlertPage, summary="List alerts (newest first)")
def list_alerts(
    status: Status | None = None, level: Level | None = None,
    source: Literal["upload", "replay", "api"] | None = None, host: str | None = Query(None, max_length=64),
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), db: Session = Depends(get_db),
):
    q = select(Alert)
    for col, val in ((Alert.status, status), (Alert.level, level), (Alert.source, source), (Alert.host, host)):
        if val is not None:
            q = q.where(col == val)
    total = db.execute(select(func.count()).select_from(q.subquery())).scalar_one()
    items = db.execute(q.order_by(Alert.created_at.desc()).limit(limit).offset(offset)).scalars().all()
    return {"total": total, "items": items}


@router.get("/alerts/{alert_id}", summary="Alert with its forecast evidence")
def get_alert(alert_id: str, db: Session = Depends(get_db)) -> dict:
    a = db.get(Alert, alert_id)
    if a is None:
        raise HTTPException(404, "alert not found")
    fc = db.get(Forecast, a.forecast_id) if a.forecast_id else None
    return {"alert": AlertOut.model_validate(a).model_dump(), "forecast": fc.payload if fc else None}


@router.patch("/alerts/{alert_id}", response_model=AlertOut, dependencies=[Depends(require_api_key)])
def update_alert(alert_id: str, body: AlertUpdate, db: Session = Depends(get_db)):
    a = db.get(Alert, alert_id)
    if a is None:
        raise HTTPException(404, "alert not found")
    return alert_svc.update_status(db, a, body.status, body.note)


@router.get("/audit", response_model=list[AuditEntryOut], summary="Latest audit-chain entries")
def list_audit(limit: int = Query(50, ge=1, le=500), db: Session = Depends(get_db)):
    return db.execute(select(AuditEntry).order_by(AuditEntry.seq.desc()).limit(limit)).scalars().all()


@router.get("/audit/verify", summary="Recompute the hash chain and report integrity")
def verify_audit(db: Session = Depends(get_db)) -> dict:
    return audit.verify(db)


@router.get("/dashboard", summary="Aggregate for the overview page")
def dashboard(reg: Registry = Depends(registry_dep), db: Session = Depends(get_db)) -> dict:
    open_by_level = dict(db.execute(select(Alert.level, func.count()).where(Alert.status == "open")
                                    .group_by(Alert.level)).all())
    recent = db.execute(select(Alert).order_by(Alert.created_at.desc()).limit(8)).scalars().all()
    jobs = db.execute(select(AnalysisJob).order_by(AnalysisJob.created_at.desc()).limit(5)).scalars().all()
    m = reg.metrics or {}
    wm = (m.get("forecast") or {}).get("world_model", {})
    headline = None
    if wm:
        headline = {
            "protocol": m["protocol"]["type"],
            "n_samples": m["protocol"]["n_samples"],
            "macro_f1": {k: wm[k]["macro_f1"] for k in wm if k in ("0", "1", "5", "10")},
            "early_warning": m.get("early_warning", {}).get("models", {}).get("world_model"),
            "lead_time": m.get("lead_time", {}).get("all"),
        }
    return {
        "model": {"version": reg.production.version if reg.production else None, "ready": reg.ready,
                  "cv_models": len(reg.cv_folds)},
        "headline_metrics": headline,
        "alerts": {"open_by_level": open_by_level, "open_total": sum(open_by_level.values()),
                   "recent": [AlertOut.model_validate(a).model_dump() for a in recent]},
        "jobs": {"by_status": job_counts(db), "recent": [JobOut.model_validate(j).model_dump() for j in jobs]},
        "audit": {"entries": audit.count(db)},
        "scenarios_available": reg.scenarios is not None,
    }
