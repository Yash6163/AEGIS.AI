"""Latent attack-state world model (PyTorch, training only).

    x[t-L+1..t] --Linear+ReLU--> GRU encoder --> h_t
    p(s_t | x)          = softmax(D h_t)                      (nowcast head)
    h_{t+k}             = GRUCell(E[s_{t+k-1}], h_{t+k-1})    (latent transition)
    p(s_{t+k} | x, s_{t..t+k-1}) = softmax(D h_{t+k})         (shared decoder)

This is an autoregressive latent state-space model of P(S[t+1] | S[t], history).
Training uses teacher forcing (maximum likelihood of the observed state
sequence); inference rolls it forward by ancestral sampling, which gives
per-step marginals, trajectory distributions and first-hit probabilities.
Production inference is a numpy port (backend/aegis/forecasting/runtime.py).
"""

from __future__ import annotations

import torch
from torch import nn


class AttackWorldModel(nn.Module):
    def __init__(self, n_features: int, n_states: int, hidden: int = 64, state_emb: int = 16, dropout: float = 0.2,
                 input_clip: float = 0.0):
        super().__init__()
        self.n_states = n_states
        self.input_clip = input_clip
        self.inp = nn.Linear(n_features, hidden)
        self.drop = nn.Dropout(dropout)
        self.encoder = nn.GRU(hidden, hidden, batch_first=True)
        self.state_emb = nn.Embedding(n_states, state_emb)
        self.transition = nn.GRUCell(state_emb, hidden)
        self.decoder = nn.Linear(hidden, n_states)

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        if self.input_clip > 0:
            x = x.clamp(-self.input_clip, self.input_clip)
        z = self.drop(torch.relu(self.inp(x)))
        _, h = self.encoder(z)
        return h[-1]

    def forward(self, x: torch.Tensor, states: torch.Tensor) -> torch.Tensor:
        """Teacher-forced logits for s_t..s_{t+K}.

        x: (B, L, F); states: (B, K+1) true states, -1 where masked.
        Returns logits (B, K+1, S).
        """
        h = self.encode(x)
        logits = [self.decoder(self.drop(h))]
        prev = states[:, 0].clamp(min=0)
        for k in range(1, states.shape[1]):
            h = self.transition(self.state_emb(prev), h)
            logits.append(self.decoder(self.drop(h)))
            # masked targets are never used for loss; any valid index keeps shapes fine
            prev = torch.where(states[:, k] >= 0, states[:, k], prev)
        return torch.stack(logits, dim=1)

    def export_numpy(self) -> dict[str, "object"]:
        sd = {k: v.detach().cpu().numpy() for k, v in self.state_dict().items()}
        return {
            "inp_w": sd["inp.weight"], "inp_b": sd["inp.bias"],
            "enc_w_ih": sd["encoder.weight_ih_l0"], "enc_w_hh": sd["encoder.weight_hh_l0"],
            "enc_b_ih": sd["encoder.bias_ih_l0"], "enc_b_hh": sd["encoder.bias_hh_l0"],
            "emb": sd["state_emb.weight"],
            "tr_w_ih": sd["transition.weight_ih"], "tr_w_hh": sd["transition.weight_hh"],
            "tr_b_ih": sd["transition.bias_ih"], "tr_b_hh": sd["transition.bias_hh"],
            "dec_w": sd["decoder.weight"], "dec_b": sd["decoder.bias"],
        }
