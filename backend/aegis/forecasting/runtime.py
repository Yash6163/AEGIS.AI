"""NumPy inference runtime for the attack-state world model.

Exact port of ml/model.py (parity is enforced by tests/test_runtime_parity.py
when torch is available). Loads weights from an .npz with allow_pickle=False,
so model loading never deserialises executable objects.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

WEIGHT_KEYS = (
    "inp_w", "inp_b", "enc_w_ih", "enc_w_hh", "enc_b_ih", "enc_b_hh", "emb",
    "tr_w_ih", "tr_w_hh", "tr_b_ih", "tr_b_hh", "dec_w", "dec_b",
)


class ArtifactError(RuntimeError):
    pass


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 0.5 * (1.0 + np.tanh(0.5 * x))


def _softmax(logits: np.ndarray) -> np.ndarray:
    z = logits - logits.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def _gru_step(x, h, w_ih, w_hh, b_ih, b_hh):
    gi = x @ w_ih.T + b_ih
    gh = h @ w_hh.T + b_hh
    H = h.shape[-1]
    r = _sigmoid(gi[:, :H] + gh[:, :H])
    z = _sigmoid(gi[:, H:2 * H] + gh[:, H:2 * H])
    n = np.tanh(gi[:, 2 * H:] + r * gh[:, 2 * H:])
    return (1.0 - z) * n + z * h


def _sample(probs: np.ndarray, u: np.ndarray) -> np.ndarray:
    cdf = np.cumsum(probs, axis=-1)
    cdf[:, -1] = 1.0
    return (u[:, None] > cdf).sum(axis=-1)


@dataclass
class Rollout:
    """Monte-Carlo rollout for B queries with N samples each."""

    nowcast: np.ndarray  # (B, S) p(s_t | x)
    paths: np.ndarray  # (B, N, K+1) sampled states s_t..s_{t+K}
    marginals: np.ndarray  # (B, K+1, S) empirical P(s_{t+k}); k=0 is the exact nowcast


@dataclass
class WorldModelRuntime:
    weights: dict[str, np.ndarray]
    manifest: dict
    mean: np.ndarray = field(init=False)
    std: np.ndarray = field(init=False)

    def __post_init__(self) -> None:
        self.mean = np.asarray(self.manifest["feature_mean"], dtype=np.float64)
        self.std = np.asarray(self.manifest["feature_std"], dtype=np.float64)

    # ------------------------------------------------------------------ io
    @classmethod
    def load(cls, artifact_dir: str | Path) -> WorldModelRuntime:
        d = Path(artifact_dir)
        manifest_path, weights_path = d / "manifest.json", d / "weights.npz"
        if not manifest_path.is_file() or not weights_path.is_file():
            raise ArtifactError(f"model artifact not found in {d}")
        manifest = json.loads(manifest_path.read_text())
        digest = hashlib.sha256(weights_path.read_bytes()).hexdigest()
        if manifest.get("weights_sha256") != digest:
            raise ArtifactError("weights.npz checksum does not match manifest")
        with np.load(weights_path, allow_pickle=False) as npz:
            missing = [k for k in WEIGHT_KEYS if k not in npz.files]
            if missing:
                raise ArtifactError(f"weights missing keys: {missing}")
            weights = {k: npz[k].astype(np.float64) for k in WEIGHT_KEYS}
        return cls(weights, manifest)

    @property
    def history(self) -> int:
        return int(self.manifest["history"])

    @property
    def max_horizon(self) -> int:
        return int(self.manifest["max_horizon"])

    @property
    def temperature(self) -> float:
        return float(self.manifest.get("temperature", 1.0))

    @property
    def n_states(self) -> int:
        return self.weights["dec_b"].shape[0]

    # ------------------------------------------------------------- compute
    def standardise(self, raw: np.ndarray) -> np.ndarray:
        """z-score with training statistics (clipping, if any, happens in encode)."""
        return (np.asarray(raw, dtype=np.float64) - self.mean) / self.std

    def encode(self, x_std: np.ndarray) -> np.ndarray:
        """x_std: (B, L, F) standardised -> h_t: (B, H)."""
        w = self.weights
        clip = float(self.manifest.get("input_clip", 0.0) or 0.0)
        if clip > 0:
            x_std = np.clip(x_std, -clip, clip)
        x = np.maximum(x_std @ w["inp_w"].T + w["inp_b"], 0.0)
        h = np.zeros((x.shape[0], w["enc_w_hh"].shape[1]))
        for t in range(x.shape[1]):
            h = _gru_step(x[:, t], h, w["enc_w_ih"], w["enc_w_hh"], w["enc_b_ih"], w["enc_b_hh"])
        return h

    def decode(self, h: np.ndarray, temperature: float | None = None) -> np.ndarray:
        T = self.temperature if temperature is None else temperature
        return _softmax((h @ self.weights["dec_w"].T + self.weights["dec_b"]) / T)

    def transition(self, h: np.ndarray, states: np.ndarray) -> np.ndarray:
        w = self.weights
        return _gru_step(w["emb"][states], h, w["tr_w_ih"], w["tr_w_hh"], w["tr_b_ih"], w["tr_b_hh"])

    def next_state_exact(self, h: np.ndarray, temperature: float | None = None) -> tuple[np.ndarray, np.ndarray]:
        """Exact p(s_t) and p(s_{t+1}) = sum_s p(s_t=s) p(s_{t+1} | h, s) by enumeration."""
        p0 = self.decode(h, temperature)
        S = self.n_states
        p1 = np.zeros_like(p0)
        for s in range(S):
            h1 = self.transition(h, np.full(h.shape[0], s))
            p1 += p0[:, s:s + 1] * self.decode(h1, temperature)
        return p0, p1

    def rollout(
        self,
        x_std: np.ndarray,
        horizon: int,
        n_samples: int = 512,
        seed: int = 0,
        temperature: float | None = None,
        h0: np.ndarray | None = None,
    ) -> Rollout:
        """Ancestral sampling of s_t..s_{t+K} for each of B input sequences.

        Common random numbers (fixed seed) make repeated calls deterministic,
        which also makes occlusion-based explanations stable.
        """
        if not 1 <= horizon <= self.max_horizon:
            raise ValueError(f"horizon must be in [1, {self.max_horizon}]")
        rng = np.random.default_rng(seed)
        h = self.encode(x_std) if h0 is None else h0
        B = h.shape[0]
        S = self.n_states
        nowcast = self.decode(h, temperature)
        u = rng.random((horizon + 1, B * n_samples))
        # Samples of one query that share a path prefix share the latent state,
        # so transitions are computed once per unique prefix ("node").
        node_of_sample = np.repeat(np.arange(B), n_samples)
        node_h, node_p = h, nowcast
        s = _sample(node_p[node_of_sample], u[0])
        paths = [s]
        for k in range(1, horizon + 1):
            keys, node_of_sample = np.unique(node_of_sample * S + s, return_inverse=True)
            node_h = self.transition(node_h[keys // S], keys % S)
            node_p = self.decode(node_h, temperature)
            s = _sample(node_p[node_of_sample], u[k])
            paths.append(s)
        paths_arr = np.stack(paths, axis=1).reshape(B, n_samples, horizon + 1)
        # counts of each state per (query, step) without materialising one-hots
        flat = (np.arange(B)[:, None, None] * (horizon + 1) + np.arange(horizon + 1)[None, None, :]) * S + paths_arr
        marg = np.bincount(flat.ravel(), minlength=B * (horizon + 1) * S).reshape(B, horizon + 1, S) / n_samples
        marg[:, 0] = nowcast
        return Rollout(nowcast=nowcast, paths=paths_arr, marginals=marg)
