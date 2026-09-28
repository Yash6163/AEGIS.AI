import json
import shutil

import numpy as np
import pytest

from aegis.forecasting.risk import assess, first_hit, risk_level
from aegis.forecasting.runtime import ArtifactError, EnsembleRuntime, load_runtime

from .conftest import MODEL_DIR


def _hist(engine, rng, n=10):
    return rng.normal(size=(n, len(engine.rt.mean))) * engine.rt.std + engine.rt.mean


def test_rollout_distributions_are_valid(engine):
    rng = np.random.default_rng(0)
    x = engine.rt.standardise(np.stack([_hist(engine, rng) for _ in range(4)]))
    r = engine.rt.rollout(x, horizon=10, n_samples=256, seed=1)
    assert r.paths.shape == (4, 256, 11)
    assert r.marginals.shape == (4, 11, engine.rt.n_states)
    np.testing.assert_allclose(r.marginals.sum(-1), 1.0, atol=1e-9)
    np.testing.assert_allclose(r.nowcast.sum(-1), 1.0, atol=1e-9)


def test_rollout_is_deterministic_for_a_seed(engine):
    x = engine.rt.standardise(_hist(engine, np.random.default_rng(3)))[None]
    a = engine.rt.rollout(x, 5, 128, seed=9).paths
    b = engine.rt.rollout(x, 5, 128, seed=9).paths
    assert (a == b).all()


def test_monte_carlo_matches_exact_one_step(engine):
    x = engine.rt.standardise(np.stack([_hist(engine, np.random.default_rng(i)) for i in range(8)]))
    r = engine.rt.rollout(x, 1, 4000, seed=0)
    _, p1 = engine.rt.next_state_exact(engine.rt.encode(x))
    assert np.abs(r.marginals[:, 1] - p1).max() < 0.05


def test_horizon_bounds(engine):
    x = engine.rt.standardise(_hist(engine, np.random.default_rng(0)))[None]
    with pytest.raises(ValueError):
        engine.rt.rollout(x, 0)
    with pytest.raises(ValueError):
        engine.rt.rollout(x, engine.rt.max_horizon + 1)


def test_forecast_payload_shape(engine):
    fc = engine.forecast(_hist(engine, np.random.default_rng(1), n=4), horizon=3, n_samples=128)
    assert len(fc["steps"]) == 4
    assert fc["history_padded"] == engine.rt.history - 4
    roots = fc["trajectory_tree"]["roots"]
    assert abs(sum(n["probability"] for n in roots) - 1.0) < 1e-9
    assert 0 <= fc["risk"]["attack_probability"] <= 1
    assert 0 <= fc["risk"]["risk_score"] <= 100
    assert fc["explanation"]["feature_contributions"]
    assert len(fc["explanation"]["temporal_contributions"]) == engine.rt.history


def test_forecast_rejects_wrong_feature_count(engine):
    with pytest.raises(ValueError):
        engine.forecast(np.zeros((5, 3)))


def test_artifact_checksum_is_enforced(tmp_path):
    d = tmp_path / "m"
    shutil.copytree(MODEL_DIR, d, ignore=shutil.ignore_patterns("cv"))
    load_runtime(d)
    manifest = json.loads((d / "manifest.json").read_text())
    manifest["weights_sha256"] = "0" * 64
    (d / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ArtifactError, match="checksum"):
        load_runtime(d)


def test_pickled_weights_are_refused(tmp_path):
    """An .npz containing object arrays needs pickle; the loader must refuse it."""
    d = tmp_path / "m"
    shutil.copytree(MODEL_DIR, d, ignore=shutil.ignore_patterns("cv"))
    with np.load(d / "weights.npz") as z:
        arrays = {k: z[k] for k in z.files}
    arrays[sorted(arrays)[0]] = np.array([object()], dtype=object)
    np.savez(d / "weights.npz", **arrays)
    import hashlib
    manifest = json.loads((d / "manifest.json").read_text())
    manifest["weights_sha256"] = hashlib.sha256((d / "weights.npz").read_bytes()).hexdigest()
    (d / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        load_runtime(d)


def test_risk_levels_and_first_hit():
    assert [risk_level(s) for s in (0, 24.9, 25, 50, 75, 100)] == ["LOW", "LOW", "MEDIUM", "HIGH", "CRITICAL", "CRITICAL"]
    paths = np.array([[0, 0, 1, 1], [0, 0, 0, 0], [0, 3, 3, 0], [0, 0, 0, 0]])
    p, t = first_hit(paths, [1, 3])
    assert p == 0.5 and t == 1.5


def test_diffuse_forecast_is_flagged_uncertain():
    S = 7
    marg = np.full((3, S), 1 / S)
    now = np.eye(S)[0]
    paths = np.random.default_rng(0).integers(0, S, size=(200, 3))
    a = assess(now, marg, paths)
    assert a.uncertain and a.confidence < 0.1
    sharp = np.tile(np.eye(S)[0], (3, 1))
    b = assess(now, sharp, np.zeros((200, 3), dtype=int))
    assert not b.uncertain and b.risk_score == 0 and b.attack_probability == 0


def test_torch_parity():
    torch = pytest.importorskip("torch")
    import sys

    from aegis.config import REPO_ROOT
    sys.path.insert(0, str(REPO_ROOT / "ml"))
    from model import AttackWorldModel

    loaded = load_runtime(MODEL_DIR)
    rt = loaded.members[0] if isinstance(loaded, EnsembleRuntime) else loaded
    m = AttackWorldModel(len(rt.mean), rt.n_states, hidden=rt.weights["enc_w_hh"].shape[1],
                         state_emb=rt.weights["emb"].shape[1], input_clip=float(rt.manifest.get("input_clip", 0)))
    sd = m.state_dict()
    mapping = {"inp.weight": "inp_w", "inp.bias": "inp_b", "encoder.weight_ih_l0": "enc_w_ih", "encoder.weight_hh_l0": "enc_w_hh",
               "encoder.bias_ih_l0": "enc_b_ih", "encoder.bias_hh_l0": "enc_b_hh", "state_emb.weight": "emb",
               "transition.weight_ih": "tr_w_ih", "transition.weight_hh": "tr_w_hh", "transition.bias_ih": "tr_b_ih",
               "transition.bias_hh": "tr_b_hh", "decoder.weight": "dec_w", "decoder.bias": "dec_b"}
    m.load_state_dict({k: torch.tensor(rt.weights[v], dtype=sd[k].dtype) for k, v in mapping.items()})
    m.eval()
    x = np.random.default_rng(0).normal(size=(5, rt.history, len(rt.mean))) * 3
    with torch.no_grad():
        h_t = m.encode(torch.tensor(x, dtype=torch.float32)).numpy()
    np.testing.assert_allclose(h_t, rt.encode(x), atol=1e-4)


def test_ensemble_is_a_proper_mixture():
    """An ensemble of identical members must reproduce the single model, and a
    mixed ensemble's exact marginals must be the member average."""
    loaded = load_runtime(MODEL_DIR)
    single = loaded.members[0] if isinstance(loaded, EnsembleRuntime) else loaded
    twin = EnsembleRuntime([single, single], single.manifest)
    x = single.standardise(np.random.default_rng(0).normal(size=(6, single.history, len(single.mean))) * single.std + single.mean)
    p0a, p1a = single.next_state_exact(single.encode(x))
    p0b, p1b = twin.next_state_exact(twin.encode(x))
    np.testing.assert_allclose(p0a, p0b, atol=1e-12)
    np.testing.assert_allclose(p1a, p1b, atol=1e-12)
    r = twin.rollout(x, 4, n_samples=101, seed=2)
    assert r.paths.shape == (6, 101, 5)
    np.testing.assert_allclose(r.marginals.sum(-1), 1.0, atol=1e-9)
    if isinstance(loaded, EnsembleRuntime) and len(loaded.members) > 1:
        m = loaded.members
        h = loaded.encode(x)
        want = np.mean([mm.next_state_exact(hh, loaded.temperature)[1] for mm, hh in zip(m, h, strict=True)], axis=0)
        np.testing.assert_allclose(loaded.next_state_exact(h)[1], want, atol=1e-12)


def test_exact_attack_probability_matches_monte_carlo(engine):
    rng = np.random.default_rng(5)
    x = engine.rt.standardise(np.stack([_hist(engine, rng) for _ in range(6)]) * 1.5)
    h = engine.rt.encode(x)
    exact = engine.rt.attack_within_exact(h, 5)
    r = engine.rt.rollout(x, 5, 20000, seed=3, h0=h)
    mc = (r.paths[:, :, 1:6] != 0).any(axis=2).mean(axis=1)
    assert np.all((exact >= 0) & (exact <= 1))
    assert np.abs(exact - mc).max() < 0.02
