import gzip
import io
import time

import pytest

from aegis.ingestion.upload import sanitize_filename

from .conftest import csv_bytes, synthetic_flows

API = "/api/v1"


def wait_job(client, job_id, timeout=60):
    t0 = time.time()
    while time.time() - t0 < timeout:
        j = client.get(f"{API}/analysis/jobs/{job_id}").json()
        if j["status"] in ("completed", "failed"):
            return j
        time.sleep(0.2)
    raise AssertionError("job did not finish")


@pytest.mark.parametrize("name,expected", [
    ("../../etc/passwd", "passwd"),
    ("..\\..\\windows\\system32\\evil.csv", "evil.csv"),
    ("flows; rm -rf *.csv", "flows_rm_-rf_.csv"),
    ("", "upload"),
    ("a" * 300 + ".csv", "a" * 100),
])
def test_sanitize_filename(name, expected):
    assert sanitize_filename(name) == expected


def test_valid_upload_is_analysed(client):
    data = csv_bytes(synthetic_flows(minutes=25, attack_from=14), gz=True)
    r = client.post(f"{API}/analysis/upload", files={"file": ("../scan.csv.gz", data, "application/gzip")},
                    data={"internal_networks": "192.168.10.0/24", "anonymize": "true"})
    assert r.status_code == 202, r.text
    job = r.json()
    assert job["filename"] == "scan.csv.gz" and job["anonymized"]
    j = wait_job(client, job["id"])
    assert j["status"] == "completed", j
    assert j["n_hosts"] == 4 and j["n_windows"] == 25 and j["has_labels"]
    tl = client.get(f"{API}/analysis/jobs/{job['id']}/timeline").json()
    assert all(h.startswith("host-") for h in tl["hosts"])  # pseudonymised, no raw IPs stored
    assert len(tl["minutes"]) == 25
    fc = client.get(f"{API}/analysis/jobs/{job['id']}/forecast", params={"host": tl["hosts"][0], "minute": 20}).json()
    assert len(fc["steps"]) == 6 and "ground_truth" in fc


@pytest.mark.parametrize("filename,payload,status", [
    ("model.pkl", b"\x80\x04\x95", 415),
    ("flows.parquet", b"PAR1", 415),
    ("flows.csv.gz", b"Timestamp,a\n1,2\n", 202),  # accepted, then fails: not gzip -> job error
    ("flows.csv", b"", 400),
])
def test_rejects_bad_files(client, filename, payload, status):
    r = client.post(f"{API}/analysis/upload", files={"file": (filename, payload, "application/octet-stream")})
    assert r.status_code == status, r.text
    if status == 202:
        j = wait_job(client, r.json()["id"])
        assert j["status"] == "failed" and "gzip" in j["error"]


def test_oversized_upload_is_rejected(client_factory):
    c = client_factory(max_upload_mb=1)
    r = c.post(f"{API}/analysis/upload", files={"file": ("big.csv", b"a," * (600_000), "text/csv")})
    assert r.status_code == 413


def test_decompression_bomb_is_stopped(client_factory):
    c = client_factory(max_uncompressed_mb=1)
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb") as fh:
        fh.write(b"Timestamp,Label\n" + b"0" * (5 << 20))  # 5 MB of zeros -> ~5 KB compressed
    r = c.post(f"{API}/analysis/upload", files={"file": ("bomb.csv.gz", buf.getvalue(), "application/gzip")})
    j = wait_job(c, r.json()["id"])
    assert j["status"] == "failed" and "decompressed" in j["error"]


def test_missing_columns_and_malformed_csv_fail_cleanly(client):
    r = client.post(f"{API}/analysis/upload", files={"file": ("x.csv", b"foo,bar\n1,2\n", "text/csv")})
    j = wait_job(client, r.json()["id"])
    assert j["status"] == "failed" and "missing required columns" in j["error"]
    r = client.post(f"{API}/analysis/upload", files={"file": ("y.csv", b"\x00\x01\x02binary", "text/csv")})
    j = wait_job(client, r.json()["id"])
    assert j["status"] == "failed"


def test_bad_cidr_is_rejected(client):
    data = csv_bytes(synthetic_flows(minutes=2, attack_from=None))
    r = client.post(f"{API}/analysis/upload", files={"file": ("f.csv", data, "text/csv")}, data={"internal_networks": "not-a-cidr"})
    assert r.status_code == 422


def test_csv_formula_content_is_treated_as_data(client):
    df = synthetic_flows(minutes=12, attack_from=None)
    df.loc[0, "Source IP"] = "=cmd|' /C calc'!A0"
    r = client.post(f"{API}/analysis/upload", files={"file": ("f.csv", csv_bytes(df), "text/csv")},
                    data={"internal_networks": "192.168.10.0/24"})
    j = wait_job(client, r.json()["id"])
    assert j["status"] == "completed"
