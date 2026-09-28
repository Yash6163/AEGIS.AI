"""Upload analysis jobs: flow CSV or PCAP -> per-host windows -> forecasts -> alerts.

The input format is detected (CICFlowMeter, Argus/CTU-13 binetflow, UNSW-NB15,
libpcap) and routed to the model whose features it can supply: CICFlowMeter
files use the CIC-IDS2017 model (37 features); everything else uses the
multi-dataset portable model (26 features)."""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC

import numpy as np
import pandas as pd
from sqlalchemy import delete

from ..config import Settings
from ..db.models import AnalysisJob, TrafficWindow, utcnow
from ..db.session import session_scope
from ..forecasting.features import (
    FlowSchemaError,
    entity_flows,
    entity_raw_stats,
    entity_window_features,
    entity_window_states,
    parse_networks,
    portable_window_features,
    window_states_from,
)
from ..forecasting.states import STATE_NAMES, UNSW_NB15_LABEL_MAP, map_ctu13_label, normalise_label
from ..ingestion.formats import to_canonical
from ..ingestion.upload import PCAP_SUFFIXES, StoredUpload, UploadError, read_flow_csv, read_pcap
from . import alerts as alert_svc
from . import audit
from .registry import get_registry

log = logging.getLogger("aegis.analysis")

MIN_HOST_FLOWS = 20
MAX_HOST_WINDOWS = 250_000
MAX_ALERTS_PER_JOB = 200
SUMMARY_SAMPLES = 128

_executor: ThreadPoolExecutor | None = None


def executor(settings: Settings) -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=settings.max_concurrent_jobs, thread_name_prefix="analysis")
    return _executor


def shutdown() -> None:
    global _executor
    if _executor is not None:
        _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None


def pseudonymise(ip: str, secret: str) -> str:
    return "host-" + hmac.new(secret.encode(), ip.encode(), hashlib.sha256).hexdigest()[:12]


def sliding_histories(features: np.ndarray, history: int) -> np.ndarray:
    """(T, F) -> (T, L, F) histories ending at every t, zero-padded at the start."""
    T, F = features.shape
    padded = np.vstack([np.zeros((history - 1, F)), features])
    idx = np.arange(T)[:, None] + np.arange(history)[None, :]
    return padded[idx]


def _label_states(ef, profile: str):
    """Window states from the file's own labels (display/evaluation only)."""
    if profile == "cic":
        return entity_window_states(ef, 60, 2)["state"]
    if profile == "binetflow":
        return window_states_from(ef.assign(state=ef["label"].map(lambda x: int(map_ctu13_label(x)))), "state", 60, 2)["state"]
    if profile == "unsw":
        mapped = ef["label"].map(lambda x: UNSW_NB15_LABEL_MAP.get(normalise_label(x) or "normal"))
        if mapped.isna().any():
            raise ValueError("unknown UNSW-NB15 attack categories")
        return window_states_from(ef.assign(state=mapped.astype(int)), "state", 60, 2)["state"]
    raise ValueError(f"no label mapping for {profile}")


def run_job(job_id: str, stored: StoredUpload, suffix: str, settings: Settings) -> None:
    t0 = time.perf_counter()
    reg = get_registry()
    try:
        with session_scope() as db:
            job = db.get(AnalysisJob, job_id)
            job.status = "running"
        if suffix in PCAP_SUFFIXES:
            flows, pstats = read_pcap(stored, suffix, settings.max_upload_rows * 10)
            profile = "pcap"
            warnings = [f"PCAP: {pstats['packets']:,} packets -> {pstats['flows']:,} bidirectional flows "
                        f"({pstats['skipped']:,} non-IPv4 packets skipped)" + (", capture truncated" if pstats["truncated"] else "")]
            if flows.empty:
                raise UploadError("no IPv4 TCP/UDP/ICMP packets in the capture")
            flows["total_pkts"] = flows["fwd_pkts"] + flows["bwd_pkts"]
        else:
            raw = read_flow_csv(stored, suffix, settings.max_uncompressed_mb << 20, settings.max_upload_rows)
            flows, profile, warnings = to_canonical(raw)
            del raw
        engine = reg.engine_for_profile("cic" if profile == "cic" else "portable")
        portable = engine.manifest.get("feature_set") == "portable"
        warnings.insert(0, f"Detected format: {profile}; model {engine.version} "
                           f"({'portable 26-feature' if portable else 'CICFlowMeter 37-feature'}).")
        with session_scope() as db:
            networks_spec = db.get(AnalysisJob, job_id).internal_networks
            anonymise = db.get(AnalysisJob, job_id).anonymized
        ef = entity_flows(flows, parse_networks(networks_spec), 60)
        if ef.empty:
            raise UploadError(f"no flows involve hosts inside {networks_spec}")
        counts = ef["entity"].value_counts()
        keep = counts[counts >= MIN_HOST_FLOWS].index
        if len(keep) < len(counts):
            warnings.append(f"{len(counts) - len(keep)} hosts with fewer than {MIN_HOST_FLOWS} flows were skipped.")
        ef = ef[ef["entity"].isin(keep)]
        if ef.empty:
            raise UploadError("no internal host has enough flows to analyse")
        feats = portable_window_features(ef, 60) if portable else entity_window_features(ef, 60)
        stats = entity_raw_stats(ef, 60)
        has_labels = "label" in ef.columns
        labels = None
        if has_labels:
            try:
                labels = _label_states(ef, profile)
            except (ValueError, KeyError) as exc:
                warnings.append(f"labels ignored: {exc}")
                has_labels = False
        if len(feats) > MAX_HOST_WINDOWS:
            raise UploadError(f"too many host-minutes ({len(feats):,}); limit is {MAX_HOST_WINDOWS:,}", 413)

        rows, alert_candidates = [], []
        L = engine.rt.history
        for host, g in feats.groupby(level="entity", sort=True):
            X = g.to_numpy(np.float64)
            hist = sliding_histories(X, L)
            summaries = []
            for i in range(0, len(hist), 4096):
                summaries.extend(engine.summarise(hist[i:i + 4096], n_samples=SUMMARY_SAMPLES, seed=i))
            shown = pseudonymise(host, settings.secret_key) if anonymise else host
            times = g.index.get_level_values("window_start")
            st = stats.loc[host]
            gate = alert_svc.AlertGate()
            for j, (ts, s) in enumerate(zip(times, summaries, strict=False)):
                label_state = STATE_NAMES[int(labels.loc[(host, ts)])] if labels is not None else None
                rows.append(TrafficWindow(
                    job_id=job_id, host=shown, window_start=ts.to_pydatetime().replace(tzinfo=UTC),
                    features=[round(float(v), 6) for v in X[j]],
                    stats={k: int(v) for k, v in st.loc[ts].items()},
                    label_state=label_state, **{k: s[k] for k in (
                        "current_state", "current_probability", "next_state", "next_probability",
                        "attack_probability", "compromise_probability", "risk_score", "risk_level", "warning")},
                ))
                if gate.should_alert(shown, j, s):
                    alert_candidates.append((shown, j, hist[j], ts, s))

        with session_scope() as db:
            db.add_all(rows)
            created = 0
            for shown, j, h, ts, s in alert_candidates[:MAX_ALERTS_PER_JOB]:
                fc = engine.forecast(h, horizon=settings.default_horizon, n_samples=settings.mc_samples, seed=j)
                fc["context"] = {"source": "upload", "job_id": job_id, "host": shown, "window_start": ts.isoformat()}
                alert_svc.create_alert(db, source="upload", context=job_id, host=shown,
                                       window_start=ts.to_pydatetime().replace(tzinfo=UTC), forecast=fc, summary=s)
                created += 1
            if len(alert_candidates) > MAX_ALERTS_PER_JOB:
                warnings.append(f"alert cap reached: {len(alert_candidates) - MAX_ALERTS_PER_JOB} further alert episodes not raised.")
            times_all = feats.index.get_level_values("window_start")
            job = db.get(AnalysisJob, job_id)
            job.status = "completed"
            job.finished_at = utcnow()
            job.model_version = engine.version
            job.n_flows = int(len(flows))
            job.n_hosts = int(feats.index.get_level_values("entity").nunique())
            job.n_windows = int(times_all.nunique())
            job.start_time = pd.Timestamp(times_all.min()).to_pydatetime().replace(tzinfo=UTC)
            job.end_time = pd.Timestamp(times_all.max()).to_pydatetime().replace(tzinfo=UTC)
            job.warnings = warnings
            job.has_labels = has_labels
            audit.append(db, "analysis.completed", job_id, {
                "file_sha256": job.file_sha256, "n_flows": job.n_flows, "n_hosts": job.n_hosts,
                "n_windows": job.n_windows, "alerts": created, "model_version": engine.version,
            })
        log.info("analysis completed", extra={"job_id": job_id, "seconds": round(time.perf_counter() - t0, 2),
                                             "flows": len(flows), "alerts": created})
    except (UploadError, FlowSchemaError, ValueError) as exc:
        _fail(job_id, str(exc))
    except Exception as exc:  # noqa: BLE001 - never leak internals to the client
        log.exception("analysis crashed", extra={"job_id": job_id})
        _fail(job_id, f"internal error while analysing the file ({type(exc).__name__})")
    finally:
        stored.cleanup()


def _fail(job_id: str, message: str) -> None:
    with session_scope() as db:
        db.execute(delete(TrafficWindow).where(TrafficWindow.job_id == job_id))
        job = db.get(AnalysisJob, job_id)
        if job is not None:
            job.status = "failed"
            job.error = message[:1000]
            job.finished_at = utcnow()
            audit.append(db, "analysis.failed", job_id, {"error": message[:300]})
