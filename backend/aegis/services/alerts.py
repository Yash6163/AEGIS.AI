"""Alert policy and persistence.

An alert is raised when a host ENTERS an alerting condition (the previous
minute for that host was not alerting), so a sustained attack produces one
alert per episode rather than one per minute. Alerting condition:
  P(any attack state within the early-warning horizon) >= validated threshold
  OR risk level HIGH/CRITICAL.
A per-host cooldown suppresses re-alerting for COOLDOWN_MINUTES after an
alert unless the risk level escalates, which stops flapping hosts from
flooding the queue.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from ..db.models import Alert, Forecast, utcnow
from . import audit

LEVEL_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
COOLDOWN_MINUTES = 10


class AlertGate:
    """Edge-triggered alerting with per-host cooldown, fed one minute at a time."""

    def __init__(self, cooldown: int = COOLDOWN_MINUTES):
        self.cooldown = cooldown
        self.prev: dict[str, bool] = {}
        self.last: dict[str, tuple[int, int]] = {}  # host -> (minute, level rank)

    def should_alert(self, host: str, minute: int, summary: dict) -> bool:
        now = is_alerting(summary)
        entered = now and not self.prev.get(host, False)
        self.prev[host] = now
        if not entered:
            return False
        rank = LEVEL_ORDER[alert_level(summary)]
        last = self.last.get(host)
        if last and minute - last[0] < self.cooldown and rank <= last[1]:
            return False
        self.last[host] = (minute, rank)
        return True


def is_alerting(summary: dict) -> bool:
    return bool(summary.get("warning")) or LEVEL_ORDER.get(summary.get("risk_level", "LOW"), 0) >= 2


def alert_level(summary: dict) -> str:
    level = summary.get("risk_level", "LOW")
    return level if LEVEL_ORDER[level] >= 1 else "MEDIUM"


def most_likely_attack_state(forecast: dict) -> str:
    """Attack state with the highest forecast probability at any future step."""
    best, best_p = "UNKNOWN", -1.0
    for step in forecast["steps"][1:]:
        for state, p in step["distribution"].items():
            if state != "NORMAL" and p > best_p:
                best, best_p = state, p
    return best


def persist_forecast(db: Session, *, source: str, context: str | None, host: str | None,
                     window_start: datetime | None, forecast: dict) -> Forecast:
    nxt = forecast["steps"][1] if len(forecast["steps"]) > 1 else forecast["steps"][0]
    row = Forecast(
        source=source, context=context, host=host, window_start=window_start,
        model_version=forecast["model_version"], horizon=forecast["horizon"],
        current_state=forecast["current"]["state"], next_state=nxt["state"],
        attack_probability=forecast["risk"]["attack_probability"],
        compromise_probability=forecast["risk"]["compromise_probability"],
        risk_score=forecast["risk"]["risk_score"], risk_level=forecast["risk"]["risk_level"],
        payload=forecast,
    )
    db.add(row)
    db.flush()
    return row


def create_alert(db: Session, *, source: str, context: str | None, host: str, window_start: datetime | None,
                 forecast: dict, summary: dict) -> Alert:
    fc = persist_forecast(db, source=source, context=context, host=host, window_start=window_start, forecast=forecast)
    predicted = most_likely_attack_state(forecast)
    ew = forecast["early_warning"]
    level = alert_level(summary)
    title = (f"{host}: {level} - P(attack within {ew['horizon']} min) {ew['probability']:.0%},"
             f" most likely attack stage {predicted}")
    alert = Alert(
        source=source, context=context, host=host, window_start=window_start,
        level=level, title=title[:255], predicted_state=predicted,
        current_state=forecast["current"]["state"],
        attack_probability=forecast["risk"]["attack_probability"],
        compromise_probability=forecast["risk"]["compromise_probability"],
        risk_score=forecast["risk"]["risk_score"], horizon=forecast["horizon"],
        model_version=forecast["model_version"], forecast_id=fc.id,
    )
    db.add(alert)
    db.flush()
    audit.append(db, "alert.created", alert.id, {
        "source": source, "context": context, "host": host, "level": alert.level,
        "window_start": window_start, "risk_score": alert.risk_score,
        "attack_probability": round(alert.attack_probability, 4), "predicted_state": predicted,
        "model_version": alert.model_version, "forecast_id": fc.id,
    })
    return alert


def update_status(db: Session, alert: Alert, status: str, note: str | None) -> Alert:
    alert.status = status
    alert.note = note
    alert.updated_at = utcnow()
    audit.append(db, f"alert.{status}", alert.id, {"status": status, "note": note})
    return alert
