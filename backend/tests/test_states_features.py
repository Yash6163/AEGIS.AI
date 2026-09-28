import numpy as np
import pandas as pd
import pytest

from aegis.forecasting import features as F
from aegis.forecasting.states import CICIDS2017_LABEL_MAP, AttackState, map_label, normalise_label

from .conftest import synthetic_flows

ALL_CIC_LABELS = ["BENIGN", "PortScan", "FTP-Patator", "SSH-Patator", "Web Attack \x96 Brute Force", "Web Attack \x96 XSS",
                  "Web Attack \x96 Sql Injection", "Heartbleed", "Bot", "Infiltration", "DoS Hulk", "DoS GoldenEye",
                  "DoS slowloris", "DoS Slowhttptest", "DDoS"]


def test_every_cicids2017_label_is_mapped():
    for label in ALL_CIC_LABELS:
        assert map_label(label) is not None, label
    assert len(CICIDS2017_LABEL_MAP) == len(ALL_CIC_LABELS)


def test_label_normalisation_handles_encoding_artifacts():
    assert normalise_label("Web Attack \x96 Brute Force") == "web attack brute force"
    assert normalise_label("Web Attack – XSS") == "web attack xss"
    assert map_label("totally unknown") is None
    assert map_label("ddos") is AttackState.IMPACT


def test_resolve_columns_reports_missing():
    with pytest.raises(F.FlowSchemaError, match="dst_port"):
        F.resolve_columns(["Timestamp", "Source IP"])


def test_twelve_hour_clock_is_corrected():
    ts, warnings = F.parse_timestamps(pd.Series(["6/7/2017 9:10", "6/7/2017 11:59", "6/7/2017 1:30"]))
    assert list(ts.dt.hour) == [9, 11, 13]
    assert warnings and "12-hour" in warnings[0]


def test_entity_windows_are_contiguous_and_labelled():
    flows, _ = F.normalise_flows(synthetic_flows(minutes=20, attack_from=12))
    ef = F.entity_flows(flows, F.parse_networks("192.168.10.0/24"))
    X = F.entity_window_features(ef)
    S = F.entity_window_states(ef)
    assert list(X.columns) == F.FEATURE_NAMES
    assert np.isfinite(X.to_numpy()).all()
    # every host has one row per minute over the full span
    per_host = X.groupby(level="entity").size()
    assert (per_host == 20).all()
    web = S.loc["192.168.10.50"]["state"]
    assert (web.iloc[12:] == int(AttackState.RECONNAISSANCE)).all()
    # the scan raises the "ports probed by one source" feature on the target
    fan = X.loc["192.168.10.50"]["log_max_src_port_fanout"]
    assert fan.iloc[15] > 3.0


def test_attack_label_needs_minimum_flow_count():
    df = synthetic_flows(minutes=3, attack_from=None)
    df.loc[0, "Label"] = "PortScan"  # a single labelled flow must not flip the window
    flows, _ = F.normalise_flows(df)
    ef = F.entity_flows(flows, F.parse_networks("192.168.10.0/24"))
    assert (F.entity_window_states(ef, min_attack_flows=2)["state"] == 0).all()


def test_broadcast_and_external_addresses_are_not_entities():
    df = synthetic_flows(minutes=2, attack_from=None)
    df.loc[0, "Destination IP"] = "192.168.10.255"
    flows, _ = F.normalise_flows(df)
    ef = F.entity_flows(flows, F.parse_networks("192.168.10.0/24"))
    assert "192.168.10.255" not in set(ef["entity"])
    assert "8.8.8.8" not in set(ef["entity"])
