"""ORM models. Raw packets/flows are never stored: only per-window aggregate
features, forecasts, alerts and the audit chain. Uploaded host IPs are
pseudonymised (HMAC) unless anonymisation is explicitly disabled."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)  # queued|running|completed|failed
    filename: Mapped[str] = mapped_column(String(255))
    file_sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    anonymized: Mapped[bool] = mapped_column(Boolean, default=True)
    internal_networks: Mapped[str] = mapped_column(String(512))
    model_version: Mapped[str | None] = mapped_column(String(64))
    n_flows: Mapped[int | None] = mapped_column(Integer)
    n_hosts: Mapped[int | None] = mapped_column(Integer)
    n_windows: Mapped[int | None] = mapped_column(Integer)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text)
    has_labels: Mapped[bool] = mapped_column(Boolean, default=False)

    windows: Mapped[list[TrafficWindow]] = relationship(back_populates="job", cascade="all, delete-orphan")


class TrafficWindow(Base):
    """Aggregate features + model summary for one host in one minute of an upload."""

    __tablename__ = "traffic_windows"
    __table_args__ = (Index("ix_windows_job_host_time", "job_id", "host", "window_start", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="CASCADE"), index=True)
    host: Mapped[str] = mapped_column(String(64))
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    features: Mapped[list] = mapped_column(JSON)
    stats: Mapped[dict] = mapped_column(JSON)
    label_state: Mapped[str | None] = mapped_column(String(32))  # only if the upload carried labels
    current_state: Mapped[str] = mapped_column(String(32))
    current_probability: Mapped[float] = mapped_column(Float)
    next_state: Mapped[str] = mapped_column(String(32))
    next_probability: Mapped[float] = mapped_column(Float)
    attack_probability: Mapped[float] = mapped_column(Float)
    compromise_probability: Mapped[float] = mapped_column(Float)
    risk_score: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(16))
    warning: Mapped[bool] = mapped_column(Boolean)

    job: Mapped[AnalysisJob] = relationship(back_populates="windows")


class Forecast(Base):
    """A persisted forecast snapshot (ad-hoc API call or alert evidence)."""

    __tablename__ = "forecasts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    source: Mapped[str] = mapped_column(String(16), index=True)  # api|upload|replay
    context: Mapped[str | None] = mapped_column(String(128))  # job id or scenario id
    host: Mapped[str | None] = mapped_column(String(64))
    window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    model_version: Mapped[str] = mapped_column(String(64))
    horizon: Mapped[int] = mapped_column(Integer)
    current_state: Mapped[str] = mapped_column(String(32))
    next_state: Mapped[str] = mapped_column(String(32))
    attack_probability: Mapped[float] = mapped_column(Float)
    compromise_probability: Mapped[float] = mapped_column(Float)
    risk_score: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(16))
    payload: Mapped[dict] = mapped_column(JSON)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    source: Mapped[str] = mapped_column(String(16), index=True)  # upload|replay|api
    context: Mapped[str | None] = mapped_column(String(128), index=True)
    host: Mapped[str] = mapped_column(String(64))
    window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    level: Mapped[str] = mapped_column(String(16), index=True)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)  # open|acknowledged|resolved
    title: Mapped[str] = mapped_column(String(255))
    predicted_state: Mapped[str] = mapped_column(String(32))
    current_state: Mapped[str] = mapped_column(String(32))
    attack_probability: Mapped[float] = mapped_column(Float)
    compromise_probability: Mapped[float] = mapped_column(Float)
    risk_score: Mapped[float] = mapped_column(Float)
    horizon: Mapped[int] = mapped_column(Integer)
    model_version: Mapped[str] = mapped_column(String(64))
    forecast_id: Mapped[str | None] = mapped_column(ForeignKey("forecasts.id", ondelete="SET NULL"))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(String(1000))


class AuditEntry(Base):
    """Append-only, SHA-256 hash-chained audit log (tamper-evident, single node)."""

    __tablename__ = "audit_entries"

    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON)
    prev_hash: Mapped[str] = mapped_column(String(64), unique=True)
    hash: Mapped[str] = mapped_column(String(64), unique=True)
