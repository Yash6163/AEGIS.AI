from __future__ import annotations

import gzip
import io

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from aegis.config import REPO_ROOT, Settings, get_settings
from aegis.forecasting.engine import ForecastEngine

MODEL_DIR = REPO_ROOT / "models" / "aegis-wm-1.1.0"


@pytest.fixture(scope="session")
def engine() -> ForecastEngine:
    return ForecastEngine.load(MODEL_DIR)


def make_settings(tmp_path, **kw) -> Settings:
    base = dict(app_env="test", database_url=f"sqlite:///{tmp_path / 'test.db'}", log_json=False, log_level="WARNING",
                rate_limit_per_minute=0, mc_samples=128, max_upload_mb=5, max_uncompressed_mb=20)
    base.update(kw)
    return Settings(_env_file=None, **base)  # never read a developer's local .env


@pytest.fixture
def client_factory(tmp_path, monkeypatch):
    clients = []

    def _make(**kw) -> TestClient:
        from aegis.main import create_app

        settings = make_settings(tmp_path, **kw)
        get_settings.cache_clear()
        monkeypatch.setattr("aegis.config.get_settings", lambda: settings)
        monkeypatch.setattr("aegis.api.deps.get_settings", lambda: settings)
        c = TestClient(create_app(settings))
        c.__enter__()
        clients.append(c)
        return c

    yield _make
    for c in clients:
        c.__exit__(None, None, None)


@pytest.fixture
def client(client_factory) -> TestClient:
    return client_factory()


def synthetic_flows(minutes: int = 20, attack_from: int | None = 12, seed: int = 0) -> pd.DataFrame:
    """CICFlowMeter-style rows: benign traffic for a few hosts plus an optional
    port-scan burst against 192.168.10.50 (labelled PortScan)."""
    rng = np.random.default_rng(seed)
    rows = []
    t0 = pd.Timestamp("2017-07-07 16:00:00")
    for m in range(minutes):
        for _ in range(40):
            src = f"192.168.10.{rng.choice([5, 8, 9])}"
            rows.append((t0 + pd.Timedelta(seconds=m * 60 + int(rng.integers(0, 60))), src, "8.8.8.8",
                         int(rng.integers(40000, 60000)), 443, 6, "BENIGN"))
        if attack_from is not None and m >= attack_from:
            for p in range(60):
                rows.append((t0 + pd.Timedelta(seconds=m * 60 + p % 60), "172.16.0.1", "192.168.10.50",
                             55555, int(rng.integers(1, 10000)), 6, "PortScan"))
    df = pd.DataFrame(rows, columns=["Timestamp", "Source IP", "Destination IP", "Source Port", "Destination Port", "Protocol", "Label"])
    n = len(df)
    df["Flow Duration"] = rng.integers(10, 2_000_000, n)
    df["Total Fwd Packets"] = rng.integers(1, 20, n)
    df["Total Backward Packets"] = np.where(df["Label"] == "PortScan", rng.integers(0, 2, n), rng.integers(1, 20, n))
    df["Total Length of Fwd Packets"] = df["Total Fwd Packets"] * 60
    df["Total Length of Bwd Packets"] = df["Total Backward Packets"] * 400
    for c in ("Flow IAT Mean", "Flow IAT Std", "Flow IAT Max"):
        df[c] = rng.integers(0, 100000, n)
    for c in ("SYN Flag Count", "FIN Flag Count", "RST Flag Count", "PSH Flag Count", "ACK Flag Count", "URG Flag Count"):
        df[c] = rng.integers(0, 2, n)
    df["Packet Length Mean"] = rng.integers(40, 900, n)
    df["Init_Win_bytes_forward"] = 29200
    df["Init_Win_bytes_backward"] = -1
    df["Timestamp"] = df["Timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")
    return df


def csv_bytes(df: pd.DataFrame, gz: bool = False) -> bytes:
    raw = df.to_csv(index=False).encode()
    if not gz:
        return raw
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb") as fh:
        fh.write(raw)
    return buf.getvalue()
