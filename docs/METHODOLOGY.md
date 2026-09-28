# Methodology

This document describes exactly what the model learns, from what data, and how
it is evaluated. Numbers live in [RESULTS.md](RESULTS.md), which is generated
from `metrics.json`.

## 1. Problem framing

The goal is **forecasting**, not classification:

```
flow records --> per-host minute windows x_t --> current state S_t (inferred)
             --> P(S_{t+1} | S_t, x_{t-L+1..t}) --> K-step rollout
             --> trajectory distribution --> P(attack / compromise within K) --> early warning
```

* **Unit of state**: one internal host in one 60-second window. Network state is
  the set of host states; the network summary is the worst host (probabilities
  are never multiplied across hosts because hosts are not independent).
* **Why per host**: the first version used one network-wide aggregate per minute.
  Low-volume attacks (≈10 botnet flows/min among thousands of benign flows)
  vanished in the aggregate, and even the *nowcast* of C2 had zero recall with
  XGBoost. Entity-centric state is what a SOC analyst reasons about anyway.

## 2. Data

* **Dataset**: CIC-IDS2017, *GeneratedLabelledFlows* version (has timestamps,
  IPs, ports), 3.1 M flows over five working days, obtained from the Hugging
  Face mirror `bvsam/cic-ids-2017` (the official UNB download requires a
  registration form). File hashes are recorded in the model manifest.
* **Timestamps**: the mirror stores UTC (testbed local time + 3 h), minute
  resolution except Monday. 288 602 empty rows in the Thursday morning file are
  dropped.
* **Hosts**: the 14 hosts of the victim LAN `192.168.10.0/24` (broadcast
  excluded). A flow between two internal hosts counts for both.
* **Only CIC-IDS2017 is implemented.** No other dataset is claimed.

## 3. Features (37 per host-minute)

Computed in `backend/aegis/forecasting/features.py` from basic per-flow
attributes (5-tuple, packet/byte counts, duration, IAT mean/std/max, TCP flag
counts, initial TCP window). Families:

| family | features |
|---|---|
| volume | log flows, log fwd/bwd packets and bytes, reply/request ratio |
| timing | mean/std of log flow duration, mean log IAT mean/std/max |
| TCP flags | SYN/FIN/RST/PSH/ACK/URG per flow |
| diversity | log distinct src IPs, dst IPs, dst ports; entropy of dst port, src IP, dst IP |
| behaviour | TCP/UDP share, share with no reply, share of sub-ms flows, mean log packet length, initial windows |
| fan-out | share of busiest source / destination, max ports and hosts contacted by one source, share to ports < 1024 |
| direction | share of flows initiated by the host, share with external peers |

Packet-level fields such as TTL and IP flags are **not** available in the flow
CSVs and are not used. Packet-derived aggregates that CICFlowMeter provides
(flag counts, initial windows, IAT) are used. A PCAP ingestion path is
future work (see `ingestion/sources.py`).

Standardisation statistics are fitted on training folds only.

## 4. States

Seven kill-chain stages mapped from dataset labels; see
[STATE_MAPPING.md](STATE_MAPPING.md). A host-minute takes the attack state with
the most labelled flows touching the host, if that state has at least 2 flows;
otherwise NORMAL.

## 5. Model: latent attack-state world model

```
x_{t-9..t} --Linear+ReLU--> GRU encoder (h_t)                      encoder
p(S_t | x)          = softmax(D h_t)                                nowcast head
h_{t+k}             = GRUCell(E[S_{t+k-1}], h_{t+k-1})              latent transition
p(S_{t+k} | x, S_t..S_{t+k-1}) = softmax(D h_{t+k} / T)             shared decoder
```

* It is an autoregressive latent state-space model of `P(S[t+1] | S[t], history)`:
  the next latent state depends on the previous latent state and on the
  previous attack state, so the model can be rolled forward without future
  observations.
* **Training**: maximum likelihood with teacher forcing over S_t..S_{t+10},
  AdamW, early stopping on validation NLL. Class re-weighting (inverse frequency
  to the power 0.25 or 0.5) was evaluated and rejected on validation folds (round 2 of
  tuning): it increased false alarms and lowered macro-F1, AUPRC and F0.5.
* **Ensemble**: five members trained with different seeds, combined as an equal-weight
  mixture (`EnsembleRuntime`): nowcasts and exact one-step marginals are averaged, and
  Monte-Carlo samples are split evenly across members. No seed is picked by score.
* **Warning threshold**: chosen on the validation fold to maximise F0.5 of "attack within
  5 minutes" (precision weighted twice as much as recall). Baselines get the same rule.
* **Inference**: ancestral Monte-Carlo sampling (512 trajectories by default).
  Sample paths that share a prefix share the latent computation, which makes
  it cheap. From the samples we get per-step marginals, a branching tree of
  trajectories, and first-hit probabilities ("attack within K", "compromise
  within K") with Monte-Carlo standard errors. The one-step marginal is also
  computed exactly by enumeration and used for explanations.
* **Why a GRU and not a Transformer**: ≈20 k training sequences of length 10,
  few attack episodes. A small recurrent model is sufficient, fast (sub-ms per
  host batched) and easy to port to NumPy. Hyper-parameters were chosen on
  validation folds (`ml/tune.py`).
* **Production runtime**: `runtime.py`, a NumPy port verified against PyTorch
  (`tests/test_model.py::test_torch_parity`). Weights are an `.npz` loaded with
  `allow_pickle=False` and checked against the manifest's SHA-256.

## 6. Evaluation protocol

* **Blocked 5-fold cross-validation.** Every day is cut into 30-minute blocks
  shared by all hosts; blocks are assigned to folds. A sample's 10-minute
  history and 10-minute future must lie in one block (targets past the block
  end are masked). **No minute of traffic or label is ever in two folds.**
* Fold assignment is stratified using labels only (a seeded search for an even
  spread of each attack state across folds), never using model results.
* For test fold f, fold f+1 is validation (early stopping, temperature,
  warning threshold) and the remaining three folds are training. Pooled
  out-of-fold predictions give one prediction per sample.
* **Why not a strict chronological split?** CIC-IDS2017 schedules each attack
  type on a single day. A forward-in-time split would test on attack types the
  model has never seen. Blocked CV is the standard compromise; its limitation
  is that train and test can contain different blocks of the *same* attack
  campaign.
* **Baselines**:
  * always-NORMAL,
  * XGBoost and Random Forest trained directly for each horizon on the history,
  * a first-order Markov chain applied to the world model's nowcast,
  * and two non-deployable references that are given the true current state:
    persistence and Markov.
* **Metrics**: accuracy, macro-F1, top-3, Brier, NLL, ECE, attack
  precision/recall, accuracy on state changes, per-class P/R/F1, confusion
  matrices, reliability bins, AUROC/AUPRC for early warning, lead time, false
  warnings per host-hour, permutation importance, latency.

## 7. Lead time

An onset is a host entering an attack state after a NORMAL minute, with at
least 5 minutes of in-block history. Lead = the number of consecutive minutes
before the onset (max 5) during which P(attack within 5 min) was above the
validation-chosen threshold. "Conventional detection" is the nowcast head
flagging the onset minute itself (lead 0). Onsets are split into:

* **campaign re-onsets**: another attack on the host in the previous 10 minutes;
* **cold onsets**: no prior attack in the history.

Cold onsets after quiet traffic are in principle hard to forecast from traffic
alone, and the numbers reflect that.

## 8. Risk, confidence and probability

| quantity | kind | definition |
|---|---|---|
| attack probability | model output | share of sampled trajectories entering any attack state within K |
| compromise probability | model output | same, for exploitation / C2 / infiltration |
| model confidence | model output | 1 - mean normalised entropy of the step distributions |
| risk score | **policy** | 100 x max(current expected severity, expected peak severity over the horizon) with analyst-set severities |
| uncertain flag | policy | next-minute entropy > 0.6 or top probability < 0.5, or input out of distribution |
| out-of-distribution | heuristic | latest window's max abs z-score / training 99.9th percentile > 1 |

## 9. Explanations

Per forecast (`explain.py`): observed evidence as z-scores against training;
occlusion attribution (reset one feature, or one history minute, to its
training mean and measure the change in the exact next-state probability).
Globally: permutation importance on test folds. We do not use SHAP. Occlusion
is exact for this model, cheap, and needs no extra dependency.

## 10. Hyper-parameter selection - a result we did not act on

`ml/tune.py` searched 16 configurations using **validation folds only** and
selected hidden 64, dropout 0.4, early stopping on unweighted NLL, LR 1e-3,
weight decay 1e-3 (`models/aegis-wm-1.0.0/tuning.log`). On the cross-validated
**test** folds, the untuned first configuration (hidden 64, dropout 0.2,
class-weighted early stopping, LR 2e-3) actually scored higher. Early-warning
AUROC was 0.898 vs 0.888, macro-F1 at +5 min 0.305 vs 0.286,
and attack recall at +5 min 62% vs 36%
(`metrics_pre_tuning_config.json` vs `metrics.json`). We keep the
validation-selected model. Switching because of test scores would turn the test
folds into a selection set and bias every reported number. The gap shows
how noisy model selection is with so few attack episodes.

### Round 2 (model v1.1.0)

A second validation-only search (`models/aegis-wm-1.1.0/tuning_round2.log`)
varied the class re-weighting strength (inverse frequency to the power 0, 0.25,
0.5) and dropout. Plain maximum likelihood (power 0) won on **every** validation
criterion at once: macro-F1, early-warning AUPRC and attack F0.5. Re-weighting
had made the model over-predict rare attack states, which is why v1.0.0 had low
precision. v1.1.0 also:

* uses a 5-member seed ensemble (no seed picked by score);
* sets the warning threshold to maximise validation F0.5, with the same rule
  applied to every baseline;
* computes P(attack within K) **exactly** instead of by Monte-Carlo. "No attack"
  is a single all-NORMAL continuation per current state, so the probability costs
  7 × K model steps. The exact value agrees with a 20 000-sample Monte-Carlo
  estimate (unit-tested) and removes the sampling ties that blurred ranking
  metrics (AUROC/AUPRC). The trajectory tree and compromise probability are
  still sampled.

v1.0.0 remains in `models/aegis-wm-1.0.0/` for comparison.

## 11. Known limitations

See the README's *Limitations* section.
