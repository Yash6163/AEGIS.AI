"""Health, readiness, model card and metrics."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ...config import Settings
from ...db.session import ping
from ...forecasting.engine import state_catalogue
from ...forecasting.features import FEATURE_DESCRIPTIONS, FEATURE_NAMES
from ...forecasting.states import CICIDS2017_LABEL_MAP
from ...services.registry import Registry
from ..deps import ready_registry, registry_dep, settings_dep

router = APIRouter(tags=["system"])


@router.get("/health", summary="Liveness probe")
def health() -> dict:
    return {"status": "ok"}


@router.get("/ready", summary="Readiness probe (model, database, scenarios)")
def ready(reg: Registry = Depends(registry_dep), settings: Settings = Depends(settings_dep)):
    checks = {
        "model": reg.production is not None,
        "database": ping(),
        "scenarios": reg.scenarios is not None,
        "cv_models": len(reg.cv_folds),
        "portable_model": reg.portable is not None,
    }
    ok = checks["model"] and checks["database"]
    body = {
        "status": "ready" if ok else "not_ready",
        "checks": checks,
        "model_version": reg.production.version if reg.production else None,
        "environment": settings.app_env,
        "errors": reg.errors,
    }
    if not ok:
        raise HTTPException(503, body)
    return body


@router.get("/model", summary="Model card: architecture, data, calibration, provenance")
def model_card(reg: Registry = Depends(ready_registry)) -> dict:
    m = reg.production.manifest
    return {
        "model_version": m["model_version"],
        "model_type": m["model_type"],
        "created_at": m["created_at"],
        "dataset": m["dataset"],
        "dataset_sha256": m["dataset_sha256"],
        "weights_sha256": m["weights_sha256"],
        "window_seconds": m["window_seconds"],
        "history_minutes": m["history"],
        "max_horizon_minutes": m["max_horizon"],
        "internal_networks": m["internal_networks"],
        "hyperparameters": m["hyperparameters"],
        "training": m["training"],
        "temperature": m["temperature"],
        "calibration": m["calibration"],
        "early_warning": m["early_warning"],
        "ood_reference": m.get("ood_reference"),
        "cv_models_loaded": sorted(reg.cv_folds),
        "features": [{"name": n, "description": FEATURE_DESCRIPTIONS[n]} for n in FEATURE_NAMES],
        "states": state_catalogue(),
        "label_mapping": [{"dataset_label": k, "state": v.name} for k, v in CICIDS2017_LABEL_MAP.items()],
    }


@router.get("/model/metrics", summary="Cross-validated evaluation metrics (computed by ml/evaluate.py)")
def model_metrics(reg: Registry = Depends(ready_registry)) -> dict:
    if reg.metrics is None:
        raise HTTPException(404, "metrics.json not found for this model; run ml/evaluate.py")
    return reg.metrics


@router.get("/model/metrics/multi", summary="Multi-dataset evaluation (CIC-IDS2017, UNSW-NB15, CTU-13, DARPA 2000, CIC-IDS2018)")
def model_metrics_multi(reg: Registry = Depends(registry_dep)) -> dict:
    if reg.metrics_multi is None:
        raise HTTPException(404, "metrics_multi.json not found; run ml/evaluate_multi.py")
    return {**reg.metrics_multi, "portable_model": reg.portable.version if reg.portable else None}
