"""Upload of flow CSVs and retrieval of analysis results."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...config import Settings
from ...db.models import AnalysisJob, TrafficWindow
from ...db.session import get_db
from ...forecasting.features import parse_networks
from ...ingestion.upload import UploadError, check_suffix, sanitize_filename, store_stream
from ...schemas.api import JobOut
from ...services import analysis as svc
from ...services import audit
from ...services.registry import Registry
from ...services.replay import network_summary
from ..deps import ready_registry, require_api_key, settings_dep

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED, response_model=JobOut,
             dependencies=[Depends(require_api_key)],
             summary="Upload a CICFlowMeter flow CSV (.csv / .csv.gz) for forecasting")
def upload(
    file: UploadFile = File(...),
    internal_networks: str = Form("192.168.0.0/16,10.0.0.0/8,172.16.0.0/12", max_length=500),
    anonymize: bool | None = Form(None),
    reg: Registry = Depends(ready_registry),
    settings: Settings = Depends(settings_dep),
    db: Session = Depends(get_db),
) -> AnalysisJob:
    name = sanitize_filename(file.filename)
    try:
        suffix = check_suffix(name)
        nets = parse_networks(internal_networks)
        if not nets or len(nets) > 20:
            raise UploadError("internal_networks must list 1-20 CIDR ranges")
        stored = store_stream(file.file, settings.max_upload_mb << 20, settings.upload_tmp_dir)
    except UploadError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    except ValueError as exc:  # bad CIDR
        raise HTTPException(422, f"invalid internal_networks: {exc}") from exc
    job = AnalysisJob(filename=name, file_sha256=stored.sha256, size_bytes=stored.size,
                      anonymized=settings.anonymize_uploads if anonymize is None else anonymize,
                      internal_networks=",".join(str(n) for n in nets))
    db.add(job)
    db.flush()
    audit.append(db, "analysis.submitted", job.id, {"file_sha256": stored.sha256, "size_bytes": stored.size,
                                                    "filename": name, "anonymized": job.anonymized})
    db.commit()
    svc.executor(settings).submit(svc.run_job, job.id, stored, suffix, settings)
    return job


@router.get("/jobs", response_model=list[JobOut], summary="Recent analysis jobs")
def list_jobs(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return db.execute(select(AnalysisJob).order_by(AnalysisJob.created_at.desc()).limit(limit)).scalars().all()


def _job(db: Session, job_id: str) -> AnalysisJob:
    job = db.get(AnalysisJob, job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    return job


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    return _job(db, job_id)


@router.get("/jobs/{job_id}/timeline", summary="Per-minute network summary and per-host states")
def timeline(job_id: str, db: Session = Depends(get_db)) -> dict:
    job = _job(db, job_id)
    if job.status != "completed":
        raise HTTPException(409, f"job is {job.status}")
    rows = db.execute(select(TrafficWindow).where(TrafficWindow.job_id == job_id)
                      .order_by(TrafficWindow.window_start, TrafficWindow.host)).scalars().all()
    minutes: dict = {}
    for r in rows:
        minutes.setdefault(r.window_start, []).append({
            "host": r.host, "current_state": r.current_state, "next_state": r.next_state,
            "attack_probability": r.attack_probability, "compromise_probability": r.compromise_probability,
            "risk_score": r.risk_score, "risk_level": r.risk_level, "warning": r.warning,
            "label_state": r.label_state, "flows": r.stats.get("flows", 0),
        })
    hosts = sorted({r.host for r in rows})
    return {
        "job_id": job_id, "hosts": hosts,
        "minutes": [{"window_start": ts, "network": network_summary(h), "hosts": h} for ts, h in minutes.items()],
    }


@router.get("/jobs/{job_id}/forecast", summary="Full forecast + explanation for one host at one minute")
def job_forecast(job_id: str, host: str = Query(max_length=64), minute: int = Query(ge=0),
                 horizon: int = Query(5, ge=1, le=10), reg: Registry = Depends(ready_registry),
                 settings: Settings = Depends(settings_dep), db: Session = Depends(get_db)) -> dict:
    job = _job(db, job_id)
    if job.status != "completed":
        raise HTTPException(409, f"job is {job.status}")
    rows = db.execute(select(TrafficWindow).where(TrafficWindow.job_id == job_id, TrafficWindow.host == host)
                      .order_by(TrafficWindow.window_start)).scalars().all()
    if not rows:
        raise HTTPException(404, "host not found in job")
    if minute >= len(rows):
        raise HTTPException(422, f"minute must be < {len(rows)}")
    L = reg.production.rt.history
    hist = np.asarray([r.features for r in rows[max(0, minute - L + 1):minute + 1]], dtype=np.float64)
    fc = reg.production.forecast(hist, horizon=horizon, n_samples=settings.mc_samples, seed=minute)
    fut = rows[minute:minute + horizon + 1]
    fc["context"] = {"source": "upload", "job_id": job_id, "host": host, "minute": minute,
                     "window_start": rows[minute].window_start.isoformat()}
    if job.has_labels:
        fc["ground_truth"] = {"states": [r.label_state for r in fut], "available_steps": len(fut),
                              "note": "labels from the uploaded file; never used as model input"}
    return fc


@router.delete("/jobs/{job_id}", status_code=204, response_class=Response, dependencies=[Depends(require_api_key)])
def delete_job(job_id: str, db: Session = Depends(get_db)) -> Response:
    job = _job(db, job_id)
    if job.status in ("queued", "running"):
        raise HTTPException(409, "job still running")
    db.delete(job)
    audit.append(db, "analysis.deleted", job_id, {"file_sha256": job.file_sha256})
    return Response(status_code=204)


def job_counts(db: Session) -> dict:
    return dict(db.execute(select(AnalysisJob.status, func.count()).group_by(AnalysisJob.status)).all())
