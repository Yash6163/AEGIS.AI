
import pytest
from sqlalchemy import update

from aegis.db.models import AuditEntry
from aegis.db.session import session_scope
from aegis.forecasting.features import FEATURE_NAMES

API = "/api/v1"


def test_health_ready_and_security_headers(client):
    r = client.get(f"{API}/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'none'" in r.headers["Content-Security-Policy"]
    assert r.headers["X-Request-ID"]
    ready = client.get(f"{API}/ready").json()
    assert ready["status"] == "ready" and ready["checks"]["model"] and ready["checks"]["database"]


def test_request_id_is_propagated_only_if_safe(client):
    assert client.get(f"{API}/health", headers={"X-Request-ID": "abc12345-trace"}).headers["X-Request-ID"] == "abc12345-trace"
    assert client.get(f"{API}/health", headers={"X-Request-ID": "<script>"}).headers["X-Request-ID"] != "<script>"


def test_model_card_and_metrics(client):
    card = client.get(f"{API}/model").json()
    assert card["model_version"].startswith("aegis-wm")
    assert len(card["features"]) == len(FEATURE_NAMES)
    assert {s["state"] for s in card["states"]} >= {"NORMAL", "IMPACT"}
    m = client.get(f"{API}/model/metrics")
    assert m.status_code == 200
    body = m.json()
    assert "world_model" in body["forecast"] and "xgboost_direct" in body["forecast"]


def test_scenario_snapshot_and_forecast(client):
    lst = client.get(f"{API}/scenarios").json()
    ids = [s["id"] for s in lst["scenarios"]]
    assert "cicids2017-thursday" in ids
    assert "not a live" in lst["data_label"]
    snap = client.get(f"{API}/scenarios/cicids2017-thursday/snapshot", params={"t": 40}).json()
    assert len(snap["hosts"]) == 14
    assert snap["model"]["mode"].startswith("cross-validation")
    fc = client.get(f"{API}/scenarios/cicids2017-thursday/forecast",
                    params={"host": "192.168.10.50", "t": 40, "horizon": 10}).json()
    assert len(fc["steps"]) == 11 and len(fc["ground_truth"]["states"]) == 11
    assert fc["context"]["fold"] == snap["model"]["fold"]


@pytest.mark.parametrize("params,code", [
    ({"t": 99999}, 422), ({"t": -1}, 422),
])
def test_snapshot_bounds(client, params, code):
    assert client.get(f"{API}/scenarios/cicids2017-thursday/snapshot", params=params).status_code == code


def test_unknown_scenario_and_host(client):
    assert client.get(f"{API}/scenarios/nope").status_code == 404
    r = client.get(f"{API}/scenarios/cicids2017-thursday/forecast", params={"host": "10.9.9.9", "t": 5})
    assert r.status_code == 404
    assert r.json()["error"]["request_id"]


def test_adhoc_forecast_roundtrip(client):
    row = {n: 0.0 for n in FEATURE_NAMES}
    r = client.post(f"{API}/forecast", json={"history": [row] * 3, "horizon": 3, "host": "h1"})
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    got = client.get(f"{API}/forecast/{fid}").json()
    assert got["horizon"] == 3 and got["id"] == fid


@pytest.mark.parametrize("history", [
    [[0.0] * 3],
    [{"log_flows": 1.0}],
    [[float("nan")] * len(FEATURE_NAMES)],
    [],
])
def test_adhoc_forecast_validation(client, history):
    r = client.post(f"{API}/forecast", json={"history": history})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_horizon_limit(client):
    r = client.post(f"{API}/forecast", json={"history": [[0.0] * len(FEATURE_NAMES)], "horizon": 11})
    assert r.status_code == 422


def test_api_key_required_for_writes_when_configured(client_factory):
    c = client_factory(api_key="k" * 24)
    body = {"history": [[0.0] * len(FEATURE_NAMES)]}
    assert c.post(f"{API}/forecast", json=body).status_code == 401
    assert c.post(f"{API}/forecast", json=body, headers={"X-API-Key": "wrong"}).status_code == 401
    assert c.post(f"{API}/forecast", json=body, headers={"X-API-Key": "k" * 24}).status_code == 201
    # reads stay open; the persisting replay stream is a write
    assert c.get(f"{API}/alerts").status_code == 200
    assert c.get(f"{API}/scenarios/cicids2017-monday/stream").status_code == 401


def test_rate_limit(client_factory):
    c = client_factory(rate_limit_per_minute=3)
    codes = [c.get(f"{API}/alerts").status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200] and codes[-1] == 429
    assert c.get(f"{API}/health").status_code == 200  # probes are exempt


def test_replay_stream_raises_alerts_and_audit_chain_detects_tampering(client):
    # Thursday minutes 20-40 cover the start of the web brute force on .50
    with client.stream("GET", f"{API}/scenarios/cicids2017-thursday/stream",
                       params={"start": 15, "interval_ms": 200}) as r:
        assert r.status_code == 200
        events = []
        for line in r.iter_lines():
            if line.startswith("event:"):
                events.append(line.split(":", 1)[1].strip())
            if events.count("snapshot") >= 25:
                break
    assert "snapshot" in events
    alerts = client.get(f"{API}/alerts", params={"source": "replay"}).json()
    assert alerts["total"] >= 1
    a = alerts["items"][0]
    detail = client.get(f"{API}/alerts/{a['id']}").json()
    assert detail["forecast"]["model_version"]
    upd = client.patch(f"{API}/alerts/{a['id']}", json={"status": "acknowledged", "note": "checked"})
    assert upd.status_code == 200 and upd.json()["status"] == "acknowledged"
    assert client.patch(f"{API}/alerts/{a['id']}", json={"status": "bogus"}).status_code == 422

    v = client.get(f"{API}/audit/verify").json()
    assert v["valid"] and v["entries"] >= 2
    with session_scope() as db:  # tamper with the first entry
        db.execute(update(AuditEntry).where(AuditEntry.seq == 1).values(payload={"forged": True}))
    v2 = client.get(f"{API}/audit/verify").json()
    assert not v2["valid"] and v2["broken_at_seq"] == 1


def test_dashboard(client):
    d = client.get(f"{API}/dashboard").json()
    assert d["model"]["ready"] and "alerts" in d and d["headline_metrics"]["n_samples"] > 0
