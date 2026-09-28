"""Request/response schemas for the public API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..forecasting.features import FEATURE_NAMES, NUM_FEATURES


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: Any | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class ForecastRequest(BaseModel):
    """Ad-hoc forecast from an explicit per-minute feature history of one host.

    Each history row is either a list of the model features in manifest order
    or an object keyed by feature name (missing names are rejected).
    """

    model_config = ConfigDict(json_schema_extra={"example": {
        "host": "10.0.0.5", "horizon": 5, "explain": True,
        "history": [{name: 0.0 for name in FEATURE_NAMES}],
    }})

    host: str | None = Field(default=None, max_length=64)
    history: list[list[float] | dict[str, float]] = Field(min_length=1, max_length=60)
    horizon: int = Field(default=5, ge=1, le=10)
    explain: bool = True
    persist: bool = True

    @field_validator("history")
    @classmethod
    def _shape(cls, rows):
        out = []
        for i, row in enumerate(rows):
            if isinstance(row, dict):
                missing = [n for n in FEATURE_NAMES if n not in row]
                extra = [k for k in row if k not in FEATURE_NAMES]
                if missing or extra:
                    raise ValueError(f"row {i}: missing {missing[:5]} unknown {extra[:5]}")
                row = [row[n] for n in FEATURE_NAMES]
            if len(row) != NUM_FEATURES:
                raise ValueError(f"row {i}: expected {NUM_FEATURES} features, got {len(row)}")
            if any(v != v or v in (float("inf"), float("-inf")) for v in row):
                raise ValueError(f"row {i}: non-finite value")
            out.append(row)
        return out


class AlertUpdate(BaseModel):
    status: Literal["acknowledged", "resolved", "open"]
    note: str | None = Field(default=None, max_length=1000)


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: str
    created_at: datetime
    updated_at: datetime | None
    source: str
    context: str | None
    host: str
    window_start: datetime | None
    level: str
    status: str
    title: str
    predicted_state: str
    current_state: str
    attack_probability: float
    compromise_probability: float
    risk_score: float
    horizon: int
    model_version: str
    forecast_id: str | None
    note: str | None


class AlertPage(BaseModel):
    total: int
    items: list[AlertOut]


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: str
    created_at: datetime
    finished_at: datetime | None
    status: str
    filename: str
    file_sha256: str
    size_bytes: int
    anonymized: bool
    internal_networks: str
    model_version: str | None
    n_flows: int | None
    n_hosts: int | None
    n_windows: int | None
    start_time: datetime | None
    end_time: datetime | None
    warnings: list[str]
    error: str | None
    has_labels: bool


class AuditEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    seq: int
    created_at: datetime
    event_type: str
    entity_id: str | None
    payload: dict
    prev_hash: str
    hash: str
