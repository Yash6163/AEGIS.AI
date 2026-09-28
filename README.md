# AEGIS: forecasting attack stages from network traffic

Smart India Hackathon · NTRO · *AI based Network Attack Forecasting from Network Traffic Data* · Blockchain & Cybersecurity

**An intrusion detector tells you which attack stage a host is in now. AEGIS forecasts
which stage it is likely to reach next, and how soon.** It learns a transition model
`P(S[t+1] | S[t], traffic history)` over per-host attack stages from CIC-IDS2017
network flows, rolls it forward K minutes by Monte-Carlo sampling, and raises an
early warning when the sampled trajectories converge on an attack or compromise state.

<!-- HEADLINE:START -->
**Cross-validated on CIC-IDS2017** (23,800 held-out host-minutes, 5-fold blocked CV). Bold = better of the two; the baseline column shows the strongest deployable baseline for that row.

| metric | world model (ours) | best deployable baseline |
|---|---:|---:|
| **Early warning** (any attack within 5 min), AUROC |  **0.879** | 0.866 (XGBoost) |
| early warning, AUPRC |  **0.432** | 0.421 (Markov) |
| early warning at the validated threshold, F0.5 |  **0.576** | 0.521 (Markov) |
| early warning at the validated threshold, F1 |  **0.433** | 0.394 (Markov) |
| early warning at the validated threshold, F2 |  **0.347** | 0.317 (Markov) |
| **State 5 min ahead**, macro-F1 (7 states) |  **0.288** | 0.235 (XGBoost) |
| attack 5 min ahead, precision |  0.697 | **0.846** (Markov) |
| attack 5 min ahead, recall |  **0.266** | 0.183 (XGBoost) |
| attack 5 min ahead, F0.5 |  **0.527** | 0.437 (XGBoost) |
| attack 5 min ahead, F2 |  **0.304** | 0.214 (XGBoost) |

**Summary (generated):** the world model is best on 9 of 10 rows; a baseline is better on: attack precision at +5 min. 14% of 85 attack onsets were warned about before they began, at 0.16 false warnings per host-hour. See [Limitations](#17-limitations).
<!-- HEADLINE:END -->

Every number in this repository is produced by a script from out-of-fold predictions
([docs/RESULTS.md](docs/RESULTS.md)). Nothing is typed in by hand, and the web console
reads the same `metrics.json`.

---

## Contents
1. [Why this matters](#1-why-this-matters) · 2. [What the system does](#2-what-the-system-does) · 3. [Architecture](#3-architecture)
4. [ML methodology](#4-ml-methodology) · 5. [Results](#5-results) · 6. [Risk, uncertainty, explanations](#6-risk-uncertainty-explanations)
7. [API](#7-api) · 8. [Database](#8-database) · 9. [Frontend](#9-frontend) · 10. [Security](#10-security)
11. [Run locally](#11-run-locally) · 12. [Docker](#12-docker) · 13. [Configuration](#13-configuration) · 14. [Tests & CI](#14-tests--ci)
15. [Reproduce training & evaluation](#15-reproduce-training--evaluation) · 16. [Demo script](#16-demo-script) · 17. [Limitations](#17-limitations) · 18. [Future work](#18-future-work)

---

## 1. Why this matters

Signature and anomaly IDSs label traffic **after** it is malicious. By the time a
brute-force login or a botnet beacon is flagged, the adversary is already
executing that stage. Multi-stage campaigns (scan → credential attack → exploit →
C2) have temporal structure that a detector ignores. Forecasting the next stage
turns an alert queue into a lead-time budget. It also says which asset to harden
first, and how confident the system is.

## 2. What the system does

For every internal host, every minute:

1. **Observe**: aggregate that host's flows into a 37-feature window `x_t` (volume,
   timing, TCP flags, port/IP diversity, fan-out, direction).
2. **Infer the current state**: `p(S_t | x_{t-9..t})` over seven kill-chain stages
   (NORMAL, RECONNAISSANCE, CREDENTIAL_ACCESS, EXPLOITATION, COMMAND_AND_CONTROL,
   INFILTRATION, IMPACT), derived from CIC-IDS2017 labels ([mapping](docs/STATE_MAPPING.md)).
3. **Roll forward K = 1…10 minutes**: sample 512 trajectories from the learned latent
   transition model, which yields per-minute state probabilities and a branching trajectory tree.
4. **Assess**: P(any attack within K), P(compromise within K), expected time to first
   attack, model confidence, an uncertainty flag, an out-of-distribution flag, and a
   policy risk score.
5. **Warn**: raise an alert when P(attack within 5 min) crosses a threshold chosen on
   validation data to maximise F0.5 (precision weighted twice as much as recall), once per episode with a per-host cooldown.
6. **Explain**: show observed evidence (z-scores), occlusion attribution per feature and
   per history minute, and log the alert to a SHA-256 hash-chained audit log.

**What it does not do** (see [Limitations](#17-limitations)): live packet capture, ATT&CK
technique identification, lateral-movement/exfiltration stages (absent from the dataset),
or any claim of performance on networks unlike CIC-IDS2017 without retraining.

## 3. Architecture

```
                 ┌──────────────────────── training (offline, ml/) ─────────────────────────┐
 CIC-IDS2017 ──▶ │ prepare_windows ─▶ tune (val folds) ─▶ evaluate (5-fold blocked CV)       │
 labelled flows  │                                   └─▶ train (production) ─▶ models/…/*.npz │
                 └─────────────────────────────────────────────────────┬─────────────────────┘
                                                                       │ weights.npz + manifest.json (SHA-256)
 Traffic source                                                        ▼
 ─────────────                      ┌──────────────── backend (FastAPI, NumPy only) ───────────────┐
 CSV upload ─────┐                  │ ingestion ─▶ per-host windows ─▶ world-model runtime          │
 Replay (demo) ──┼─ TrafficSource ─▶│   ─▶ Monte-Carlo rollout ─▶ risk engine ─▶ alert gate ─▶ SSE  │
 NetFlow/PCAP ───┘  (interface;     │   ─▶ explanations        ─▶ Postgres (jobs, windows,         │
 (future)           not implemented)│                              forecasts, alerts, audit chain)  │
                                    └───────────────────────────────▲──────────────────────────────┘
                                                                    │ /api/v1 (+ X-API-Key, server-side)
                                    ┌───────────────────────────────┴──────────────────────────────┐
 Analyst browser ◀───── same origin │ Next.js console · /api/backend proxy (key never in browser)   │
                                    └──────────────────────────────────────────────────────────────┘
```

| path | contents |
|---|---|
| `ml/` | data preparation, model (PyTorch), training, tuning, cross-validation, baselines, report |
| `backend/aegis/forecasting/` | states, features, NumPy runtime, risk engine, explanations, engine |
| `backend/aegis/ingestion/` | hardened upload parsing, traffic-source interface, replay store |
| `backend/aegis/services/` | analysis jobs, alerts, audit chain, replay, model registry |
| `backend/aegis/api/` | FastAPI routers, middleware, dependencies |
| `backend/migrations/` | Alembic migrations |
| `frontend/` | Next.js 14 SOC console |
| `models/aegis-wm-1.1.0/` | production artifact, 5 cross-validation fold models, `metrics.json` |
| `data/scenarios/` | per-host window features of the five capture days (replay), 3 MB |
| `data/samples/` | a real 75-minute CIC-IDS2017 flow file for trying uploads |
| `docs/` | [audit of the original prototype](docs/AUDIT.md), [methodology](docs/METHODOLOGY.md), [results](docs/RESULTS.md), [state mapping](docs/STATE_MAPPING.md), [security](docs/SECURITY.md) |

## 4. ML methodology

Full detail: [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

* **Dataset**: CIC-IDS2017 *GeneratedLabelledFlows* (3.1 M flows, 5 days, 14 LAN hosts).
  It is the only dataset implemented.
* **State representation**: one host × one minute. The first iteration used a single
  network-wide vector per minute, and low-volume attacks (botnet C2) were invisible in it,
  so the design moved to per-host state (see methodology §1).
* **Model**: a GRU latent world model. An encoder reads 10 minutes of features. A
  `GRUCell` transition advances the latent state conditioned on the previous attack
  state, and a shared decoder emits the state distribution. It is trained by maximum
  likelihood over `S_t…S_{t+10}` (teacher forcing) and rolled out by ancestral sampling.
  Production uses an equal-weight **ensemble of 5 such models** (different seeds; samples
  are split across members, so every output is a proper mixture). Each member has about
  44 k parameters. P(attack within K) is computed exactly (a single all-NORMAL path per
  current state); trajectory trees and compromise probability are sampled. A small recurrent model fits the data size, and a Transformer was not
  justified. Training uses plain maximum likelihood: class re-weighting was tried and
  rejected on validation data because it lowered precision without improving macro-F1.
* **Evaluation**: 5-fold **blocked** cross-validation with 30-minute blocks, where
  sequences never cross a block boundary, so no traffic minute or label is shared
  between train and test. Hyper-parameters, early stopping, temperature and the warning
  threshold use validation folds only.
* **Baselines**: always-NORMAL, XGBoost and Random Forest trained *directly* for each
  horizon, a Markov chain on the model's nowcast, and two non-deployable oracles that
  are given the true current state (persistence, Markov).
* **Production runtime**: a NumPy port, parity-tested against PyTorch, so the serving
  image has no torch dependency.

## 5. Results

<!-- RESULTS:START -->
| model | now | +1 min | +3 min | +5 min | +10 min |
|---|---:|---:|---:|---:|---:|
| **World model (ours)** | 0.358 | 0.324 | 0.301 | 0.288 | 0.189 |
| XGBoost, direct per horizon | 0.388 | 0.302 | 0.264 | 0.235 | 0.183 |
| Random forest, direct per horizon | 0.326 | 0.257 | 0.246 | 0.228 | 0.174 |
| Markov chain on nowcast | 0.358 | 0.329 | 0.312 | 0.215 | 0.177 |
| Always NORMAL | 0.142 | 0.142 | 0.142 | 0.142 | 0.142 |
| Persistence, true current state *(oracle)* | 1.000 | 0.717 | 0.627 | 0.615 | 0.528 |
| Markov, true current state *(oracle)* | 1.000 | 0.545 | 0.403 | 0.339 | 0.251 |

*Macro-F1 by forecast horizon, pooled out-of-fold. Oracle rows are given the true current state.*

Full tables (attack recall/precision, state-change accuracy, Brier, calibration, early warning, lead time, per-class, importance): [docs/RESULTS.md](docs/RESULTS.md).
<!-- RESULTS:END -->

How to read these numbers:
* ~98 % of host-minutes are NORMAL, so **accuracy is not informative**. Use macro-F1,
  attack recall/precision and early-warning AUROC/AUPRC.
* The oracle baselines see the true current state. Forecasting "the state will stay as
  it is" from perfect knowledge of the present is a strong upper reference that no
  deployable model has.
* **v1.1.0 sits at a precision-weighted operating point** (no class re-weighting, F0.5 warning
  threshold). It is best on the early-warning metrics and on the +5 min forecast, but not on
  everything:
  * current-state detection ("now") is below XGBoost;
  * at +1/+3 min, a Markov chain applied to *our own* nowcast is marginally ahead on
    macro-F1, F0.5 and Brier;
  * tree models and the Markov chain are more precise at most horizons because they
    rarely predict an attack, and they miss far more attacks;
  * compared with v1.0.0, it raises 7x fewer false warnings but warns before fewer onsets.
  These are real trade-offs, not tuning gaps. All tables are in [RESULTS.md](docs/RESULTS.md).
* EXPLOITATION and INFILTRATION each occur as a single short episode in the whole
  dataset (17 and 2 test host-minutes). Per-class scores for them are not meaningful.
* Most attack onsets in CIC-IDS2017 are re-onsets within a running campaign (e.g.
  periodic botnet beacons). Lead-time numbers are reported separately for cold onsets,
  which traffic alone largely cannot predict.

## 6. Risk, uncertainty, explanations

| quantity | kind | meaning |
|---|---|---|
| **Attack probability** | model output | share of sampled trajectories entering any attack state within K |
| **Compromise probability** | model output | same, for exploitation / C2 / infiltration |
| **Model confidence** | model output | 1 − mean normalised entropy of the forecast distributions |
| **Risk score** 0-100 | policy | `100 × max(current expected severity, expected peak severity)` using analyst severities; levels LOW < 25 ≤ MEDIUM < 50 ≤ HIGH < 75 ≤ CRITICAL |
| **Uncertain** | policy | diffuse next-minute distribution (entropy > 0.6 or top-p < 0.5) or out-of-distribution input |
| **Out-of-distribution** | heuristic | latest window's max abs z-score is above the 99.9th percentile seen in training |

The UI keeps these separate and labels each one. Explanations are computed per forecast:
observed evidence (z-scores against training), occlusion attribution by feature and by
history minute on the exact next-state probability, and global permutation importance
(on the model page).

## 7. API

Interactive docs at `http://localhost:8000/docs` (disabled when `APP_ENV=production`).
Write operations require `X-API-Key` when `API_KEY` is set (mandatory in production).

| method & path | purpose |
|---|---|
| `GET /api/v1/health` · `GET /api/v1/ready` | liveness · readiness (model, DB, scenarios, CV models) |
| `GET /api/v1/model` · `GET /api/v1/model/metrics` | model card, provenance hashes, states, mapping · cross-validated metrics |
| `POST /api/v1/forecast` 🔑 · `GET /api/v1/forecast/{id}` | forecast from an explicit per-minute feature history · fetch a stored forecast |
| `GET /api/v1/scenarios` · `/{id}` | replay days, ground-truth episodes, traffic timeline |
| `GET /api/v1/scenarios/{id}/snapshot?t=` | all hosts at minute t (nowcast, P(attack), risk) using the out-of-sample CV model |
| `GET /api/v1/scenarios/{id}/forecast?host=&t=&horizon=` | full K-step forecast, tree, explanation, ground truth for comparison |
| `GET /api/v1/scenarios/{id}/stream?start=&interval_ms=` 🔑 | Server-Sent Events replay: `snapshot` + `alert` events (persists alerts) |
| `POST /api/v1/analysis/upload` 🔑 | upload CICFlowMeter `.csv`/`.csv.gz` → `202` job |
| `GET /api/v1/analysis/jobs` · `/{id}` · `/{id}/timeline` · `/{id}/forecast?host=&minute=` | job status, per-minute results, drill-down forecast |
| `DELETE /api/v1/analysis/jobs/{id}` 🔑 | delete a job and its windows |
| `GET /api/v1/alerts` · `/{id}` · `PATCH /api/v1/alerts/{id}` 🔑 | list/filter · alert + forecast evidence · acknowledge/resolve |
| `GET /api/v1/audit` · `GET /api/v1/audit/verify` | audit entries · recompute the hash chain |
| `GET /api/v1/dashboard` | overview aggregate |

Errors use one envelope, `{"error": {"code", "message", "request_id", "details?"}}`, with
`400/401/404/409/413/415/422/429/503` as appropriate. Every response carries `X-Request-ID`.

## 8. Database

SQLAlchemy 2.0 with Alembic migrations (`backend/migrations`). SQLite serves development
and tests; PostgreSQL 16 serves Docker/production (migrations are verified on Postgres).

| table | contents |
|---|---|
| `analysis_jobs` | upload metadata, file SHA-256, status, counts, warnings |
| `traffic_windows` | per host-minute aggregate features, display stats, model summary. **Raw flows are never stored**; host IPs are HMAC-pseudonymised by default |
| `forecasts` | persisted forecast payloads (API calls, alert evidence) |
| `alerts` | level, status, predicted state, probabilities, link to forecast |
| `audit_entries` | hash-chained log (`prev_hash`, `hash`, unique constraints) |

## 9. Frontend

A Next.js 14 console. All data comes from the API through a same-origin proxy.

| page | what it answers |
|---|---|
| **Overview** | the innovation in one sentence, headline CV metrics against baselines, open alerts, entry points to each capture day |
| **Forecast console** (flagship) | replay a day minute by minute (Start / Pause / Next minute / Reset / speed; horizon K = 1/3/5/10). It shows the ground-truth strip per host, a host table with nowcast, P(attack) and risk, and the selected host's forecast: state probabilities per minute beside what actually happened, a branching trajectory tree, and evidence and attributions. The page is labelled **Simulation / demo traffic** |
| **Alerts** | filter by status/level/source, acknowledge/resolve, open the forecast that raised the alert |
| **Traffic analysis** | upload flows, per-minute network risk, per-host inferred state strip (with labels if present), drill-down forecast |
| **Model & evaluation** | model card, protocol, horizon curves against baselines, early warning, lead time, confusion matrix, calibration, permutation importance, state mapping |
| **System & audit** | readiness, audit-chain verification, latest entries |

Charts are hand-written SVG using a colour-vision-deficiency-validated palette. Identity
is never conveyed by colour alone, and there are no 3D effects or decorative animation.

## 10. Security

Summary (full table in [docs/SECURITY.md](docs/SECURITY.md)):
* uploads are hardened: size cap, gzip-bomb limit, content sniffing, column whitelist,
  row cap, sanitised filenames, no pickle or parquet from users;
* model weights are loaded with `allow_pickle=False` and a SHA-256 check;
* API-key auth on all writes, a server-side proxy so the key never reaches the browser,
  rate limiting, strict CORS, security headers (CSP, frame denial, nosniff);
* uploaded host IPs are pseudonymised and raw flows are not retained;
* hash-chained audit log with a verification endpoint;
* non-root, read-only containers.

## 11. Run locally

Prerequisites: Python 3.12, Node 20+ (Node 24 tested).

```bash
# backend (inference only needs backend/requirements.txt)
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements-dev.txt
cd backend && uvicorn aegis.main:app --port 8000      # SQLite + committed model artifact
```

```bash
# frontend (second terminal)
cd frontend && npm ci && BACKEND_URL=http://localhost:8000 npm run dev
```

Open http://localhost:3000. Nothing needs training first: the model artifact, CV fold
models, metrics and replay scenarios are committed (≈ 4 MB).

## 12. Docker

```bash
cp .env.example .env      # set POSTGRES_PASSWORD, SECRET_KEY, API_KEY
docker compose up --build
```

This starts Postgres 16, the API (Alembic migrations run on start, one uvicorn worker,
non-root, read-only filesystem) and the web console on http://localhost:3000. Only the
console port is published. Images are multi-stage, and the backend image contains no
training dependencies.

> Verified on macOS (Colima, Docker 29): both images build, `docker compose up` brings
> all three services to *healthy*, Alembic migrates Postgres, and an end-to-end run through
> the console proxy works: readiness, sample upload, replay stream with alerts, and audit-chain
> verification. The API runs in production mode (`/docs` off) as a non-root user on a
> read-only filesystem. Image sizes: backend ≈ 630 MB, frontend ≈ 225 MB.

## 13. Configuration

Backend (environment or `.env`; see `.env.example`):

| variable | default | notes |
|---|---|---|
| `APP_ENV` | `development` | `production` disables /docs, requires `SECRET_KEY` + `API_KEY`, skips `create_all` |
| `DATABASE_URL` | `sqlite:///./aegis.db` | e.g. `postgresql+psycopg://user:pass@host/db` |
| `SECRET_KEY` | dev placeholder | keys the HMAC for IP pseudonymisation |
| `API_KEY` | unset | required header `X-API-Key` for writes |
| `CORS_ORIGINS` | `http://localhost:3000` | comma-separated |
| `MODEL_DIR` | `models/aegis-wm-1.1.0` | artifact directory (manifest + weights + cv/ + metrics) |
| `SCENARIO_PATH` | `data/scenarios/cicids2017_replay.npz` | replay bundle |
| `LOG_LEVEL`, `LOG_JSON` | `INFO`, `true` | structured JSON logs with request ids |
| `RATE_LIMIT_PER_MINUTE` | 240 | per client, 0 disables |
| `MAX_UPLOAD_MB`, `MAX_UNCOMPRESSED_MB`, `MAX_UPLOAD_ROWS` | 50, 512, 2 000 000 | upload limits |
| `MC_SAMPLES`, `DEFAULT_HORIZON`, `ANONYMIZE_UPLOADS` | 512, 5, true | |

Frontend (server-side only): `BACKEND_URL`, `API_KEY`.

## 14. Tests & CI

```bash
cd backend && pytest -q          # 53 tests: features, labels, runtime, parity, risk, API, upload security, audit tampering
cd frontend && npm test          # component, API-client, loading/error-state tests
cd frontend && npm run lint && npm run typecheck && npm run build
```

`.github/workflows/ci.yml` runs lint, backend tests, a migration up/down round-trip,
frontend lint/typecheck/tests/build, and both Docker builds.

## 15. Reproduce training & evaluation

```bash
pip install -r ml/requirements.txt
# 1. data: CIC-IDS2017 GeneratedLabelledFlows (≈306 MB) from the HF mirror
mkdir -p data/raw && for f in Monday-WorkingHours Tuesday-WorkingHours Wednesday-workingHours \
  Thursday-WorkingHours-Morning-WebAttacks Thursday-WorkingHours-Afternoon-Infilteration \
  Friday-WorkingHours-Morning Friday-WorkingHours-Afternoon-PortScan Friday-WorkingHours-Afternoon-DDos; do
  curl -L -o data/raw/$f.parquet \
    "https://huggingface.co/datasets/bvsam/cic-ids-2017/resolve/main/traffic_labels/$f.pcap_ISCX.csv.parquet"; done
python ml/prepare_windows.py     # -> data/processed/windows.parquet (host x minute table)
python ml/tune.py                # optional: hyper-parameter search on validation folds
python ml/train.py               # -> models/aegis-wm-1.1.0/{weights.npz,manifest.json}
python ml/evaluate.py            # 5-fold CV + baselines -> metrics.json, cv/fold*/
python ml/build_scenarios.py     # -> data/scenarios (replay bundle)
python ml/report.py              # -> docs/RESULTS.md
python ml/make_sample.py         # -> data/samples/*.csv.gz (upload demo file)
```

The SHA-256 of every raw file is recorded in `manifest.json`. Everything is seeded,
and a full run takes about 20 minutes on a laptop CPU.

**Model versioning**: the artifact directory name is the model version. `manifest.json`
records the dataset hashes, hyper-parameters, seeds, calibration, early-warning threshold
and weight hash. The API reports the version on every forecast and alert. To ship a new
model, write a new `models/<version>/` directory and point `MODEL_DIR` at it.

## 16. Demo script

1. **Overview**: one-sentence pitch; show the forecast-versus-baselines numbers (from `metrics.json`).
2. **Forecast console → Thursday**: explain that each host-minute is forecast by the
   cross-validation model that never saw that 30-minute block. Scrub to just before the
   web brute force on `192.168.10.50` and press **Start**. Watch P(attack) rise, the
   warning trigger and the alert toast. Open the host and point at the trajectory tree,
   the *actual* row under the probabilities, and *Why this forecast*.
3. Switch **K** between 1 / 5 / 10 to show how the distribution spreads with horizon, and
   how confidence drops.
4. **Friday**: the botnet's 4-on/1-off C2 beaconing is forecast across the gaps. Show a
   false positive too, and explain the false-warning rate from the model page.
5. **Traffic analysis**: upload `data/samples/cicids2017_thursday_1205_75min.csv.gz`
   (anonymisation on) and drill into a host.
6. **Alerts → System**: acknowledge an alert, then verify the audit chain.
7. **Model & evaluation**: protocol, baselines, lead time for cold vs campaign onsets,
   calibration, and the limitations.

## 17. Limitations

* **One dataset, one lab network.** Everything is trained and evaluated on CIC-IDS2017
  (14 hosts, 5 days, scripted attacks). Blocked CV still shares *campaigns* across folds.
  Performance on a different network is unknown, and the OOD flag is only a heuristic
  warning.
* **Scripted attack schedule.** Transitions between attack types follow the dataset
  authors' timetable, not real adversary decision-making. The model learns campaign
  dynamics (continuation, pauses, periodic beacons, escalation within a campaign), not
  universal kill-chain laws.
* **Rare states.** EXPLOITATION, INFILTRATION and RECONNAISSANCE have very few
  host-minutes. Their per-class metrics are not statistically meaningful.
* **Cold onsets** (an attack starting after quiet traffic) are largely unpredictable
  from traffic alone. Lead time comes mostly from within-campaign forecasting.
* **False warnings** exist at the chosen operating point (see RESULTS). The threshold
  is a documented trade-off.
* **No live capture.** Replay is recorded traffic, clearly labelled. Uploads must be
  CICFlowMeter-style flow CSVs; there is no PCAP/NetFlow ingestion yet.
* **Risk score and severities are policy**, not learned.
* **Security**: a single shared API key, no user accounts, a single-node audit chain,
  and per-process rate limiting.
* The demo upload sample overlaps the production model's training data. Judge accuracy
  from CV and the out-of-sample replay, not from that file.

## 18. Future work

* Evaluate cross-dataset (CSE-CIC-IDS2018, UNSW-NB15 with timestamps) and add a
  leave-one-day-out stress test.
* PCAP and NetFlow/IPFIX sources implementing `TrafficSource`, with packet-level
  features (TTL, IP flags).
* Host-graph context (a message-passing layer over communicating hosts) to model
  lateral movement once data with such stages is available.
* Conformal prediction sets for calibrated uncertainty guarantees; drift monitoring.
* OIDC user auth and roles; an external anchor for the audit-chain head; a shared job
  queue and rate limiter for horizontal scaling.

---

Original prototype audit: [docs/AUDIT.md](docs/AUDIT.md) (the earlier UI was entirely
mock data; it is preserved at git tag `pre-refactor-audit`).
Dataset: Sharafaldin, Lashkari, Ghorbani, *Toward Generating a New Intrusion Detection
Dataset and Intrusion Traffic Characterization*, ICISSP 2018.
