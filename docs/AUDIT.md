# Forensic audit of the original codebase

Audited commit: `cffaaa3` (tagged `pre-refactor-audit`), 28 Sep 2026.
Method: read every source file, ran the app, searched for network calls,
data sources and randomness, and compared the README's claims with the code.

## What existed

A Next.js 14 single-page application (≈9.8k lines of TSX/TS):
10 routes, a Three.js/React-Three-Fiber "cyber universe", GSAP/Framer
animations, and a service layer whose only implementations were
`src/services/mock/*`. **There was no backend, no ML code, no dataset, no
model, no database, no tests, no Docker and no CI.**

## Findings by category

| Category | Finding | Evidence |
|---|---|---|
| **Working** | Next.js app builds and renders. Visual design system (Tailwind tokens, cards) existed. | `npm run build` |
| **Partially working** | Service-interface pattern (`IPredictionService`, …) was a reasonable seam for a real API client. | `src/services/contracts/*` |
| **Broken** | Settings page fields (ML endpoint, RPC URL, TAXII URL) changed local state only; nothing read them. | `src/app/settings/page.tsx` |
| **Missing** | Backend, ML pipeline, dataset handling, trained model, persistence, tests, containers, CI. | repository tree |
| **Fabricated (critical)** | Every prediction, probability, risk score, "86.4 % infiltration", ETA, SHAP value, attention weight, MITRE mapping, ledger hash, block number and dataset description was a string/number literal. `simulateKSteps` rescaled literals by a slider value. | `src/services/mock/mockData.ts` (1 158 lines), `MockPredictionService.ts` |
| **Fabricated claims in README** | TGNN + multi-head attention, KernelSHAP, Merkle audit ledger, STIX/TAXII syndication, MITRE ATT&CK v14 technique mapping, ISO/IEC 27037 compliance, "15-30 minutes before lateral movement". None implemented. | `README.md` |
| **Technically weak** | "World model" was a hard-coded 6-row table; K-step rollout returned slices of that table. No notion of state, transition or probability. | `mockFutureSteps` |
| **Security risk** | None exploitable (no server), but the UI implied live network monitoring and blockchain evidence that did not exist - a trust/integrity risk. `.env.example` pointed `NEXT_PUBLIC_*` variables at non-existent services. | `.env.example` |
| **Deployment blocker** | Nothing to deploy beyond a static front end; no API to connect to. | - |
| **SIH judge risk** | Maximal. A single question ("show me the model", "what is the test split?", "where does 86.4 % come from?") collapses the demo. Decorative 3D scene, fake terminal text and "competitors" page reinforce the impression of a mock-up. | - |

## Scientific check: forecasting or classification?

Neither. The original system performed **no inference at all**. It displayed
a pre-written attack narrative. It is not a classifier, and it is not a forecaster.

## Decision

| Component | Decision | Reason |
|---|---|---|
| Mock data, mock services, 3D scene, blockchain/threat-intel/competitor pages | **Removed** | Fabricated; no honest way to keep them. |
| Next.js + Tailwind stack, dark SOC direction | **Kept** | Sound choice, team familiarity. |
| Service seam | **Replaced** by a typed API client over a same-origin proxy. | Real backend now exists. |
| "Blockchain" theme | **Replaced** by a real SHA-256 hash-chained audit log, honestly described as single-node and tamper-evident. | Fits the Blockchain & Cybersecurity theme without over-claiming. |

The original UI remains recoverable via `git checkout pre-refactor-audit`.
