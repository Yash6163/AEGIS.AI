"""Tamper-evident audit chain.

Each entry stores hash = SHA256(prev_hash || canonical_json(entry)). Editing or
deleting any past row breaks verification of every later row. This is a
single-node hash chain (the integrity idea behind blockchains), NOT a
distributed ledger: it detects tampering but does not prevent a party with
full database access from rewriting the whole chain. Periodically publishing
the head hash to an external witness would close that gap (see docs).
"""

from __future__ import annotations

import hashlib
import json
import threading
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db.models import AuditEntry, utcnow

GENESIS = "0" * 64
_lock = threading.Lock()


def _ts(dt: datetime) -> str:
    """UTC second-resolution timestamp, identical whether or not the DB keeps tzinfo."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _canonical(seq: int, created_at: datetime, event_type: str, entity_id: str | None, payload: dict) -> bytes:
    body = {"seq": seq, "created_at": _ts(created_at), "event_type": event_type,
            "entity_id": entity_id, "payload": payload}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), default=str).encode()


def compute_hash(prev_hash: str, seq: int, created_at: datetime, event_type: str, entity_id: str | None, payload: dict) -> str:
    return hashlib.sha256(prev_hash.encode() + _canonical(seq, created_at, event_type, entity_id, payload)).hexdigest()


def append(db: Session, event_type: str, entity_id: str | None, payload: dict) -> AuditEntry:
    """Append an entry. Serialised in-process; the UNIQUE(prev_hash) constraint
    makes a concurrent writer from another process fail instead of forking."""
    with _lock:
        last = db.execute(select(AuditEntry).order_by(AuditEntry.seq.desc()).limit(1)).scalar_one_or_none()
        seq = (last.seq + 1) if last else 1
        prev = last.hash if last else GENESIS
        created = utcnow().replace(microsecond=0)
        payload = json.loads(json.dumps(payload, default=str))
        entry = AuditEntry(seq=seq, created_at=created, event_type=event_type, entity_id=entity_id,
                           payload=payload, prev_hash=prev,
                           hash=compute_hash(prev, seq, created, event_type, entity_id, payload))
        db.add(entry)
        db.flush()
        return entry


def verify(db: Session) -> dict:
    prev = GENESIS
    n = 0
    for e in db.execute(select(AuditEntry).order_by(AuditEntry.seq)).scalars():
        n += 1
        created = e.created_at
        expected = compute_hash(prev, e.seq, created, e.event_type, e.entity_id, e.payload)
        if e.prev_hash != prev or e.hash != expected or e.seq != n:
            return {"valid": False, "entries": n, "broken_at_seq": e.seq, "head": prev}
        prev = e.hash
    return {"valid": True, "entries": n, "broken_at_seq": None, "head": prev}


def count(db: Session) -> int:
    return int(db.execute(select(func.count()).select_from(AuditEntry)).scalar_one())
