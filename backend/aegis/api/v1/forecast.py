"""Ad-hoc forecasts from explicit feature histories."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...config import Settings
from ...db.models import Forecast
from ...db.session import get_db
from ...schemas.api import ForecastRequest
from ...services import alerts as alert_svc
from ...services.registry import Registry
from ..deps import ready_registry, require_api_key, settings_dep

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_api_key)],
             summary="Forecast the attack-state trajectory of one host")
def create_forecast(body: ForecastRequest, reg: Registry = Depends(ready_registry),
                    settings: Settings = Depends(settings_dep), db: Session = Depends(get_db)) -> dict:
    fc = reg.production.forecast(np.asarray(body.history, dtype=np.float64), horizon=body.horizon,
                                 n_samples=settings.mc_samples, with_explanation=body.explain)
    fc["context"] = {"source": "api", "host": body.host}
    if body.persist:
        row = alert_svc.persist_forecast(db, source="api", context=None, host=body.host, window_start=None, forecast=fc)
        fc["id"] = row.id
    return fc


@router.get("/{forecast_id}", summary="Fetch a persisted forecast")
def get_forecast(forecast_id: str, db: Session = Depends(get_db)) -> dict:
    row = db.get(Forecast, forecast_id)
    if row is None:
        raise HTTPException(404, "forecast not found")
    return {"id": row.id, "created_at": row.created_at, "source": row.source, **row.payload}
