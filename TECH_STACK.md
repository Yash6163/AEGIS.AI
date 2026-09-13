# AEGIS.AI Technology Stack Architecture

## Theoretical Foundations, Component Specifications, and Technical Rationale

This document provides a comprehensive technical audit of the technologies, architectural patterns, mathematical models, and frameworks powering the AEGIS.AI Predictive Cyber Defence System.

---

## 1. System Architecture Overview

AEGIS.AI transitions cybersecurity operations from reactive intrusion detection (alerting on attacks already completed) to continuous forward-state prediction (anticipating adversary multi-step trajectories $K$-steps ahead).

```
                      +-------------------------------------------------------+
                      |               DATA INGESTION ENGINE                   |
                      |       Raw PCAP / PCAPNG Buffers & CSV Telemetry        |
                      +---------------------------+---------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      |              TRAFFIC EXTRACTION & ENTROPY             |
                      | 5-Tuple Sockets, Shannon Entropy H(X), Inter-Arrival  |
                      +---------------------------+---------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      |              TEMPORAL GRAPH EMBEDDER                  |
                      |     Adjacency Matrix A(t) + Feature Matrix X(t)       |
                      +---------------------------+---------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      |                 AI WORLD MODEL ENGINE                 |
                      |    TGNN + Temporal Attention | P(S(t+1) | S(t))       |
                      +-------------+---------------------------+-------------+
                                    |                           |
            +-----------------------+                           +-----------------------+
            v                                                                           v
+-------------------------------+                                           +-------------------------------+
|  FORWARD STATE FORECASTER     |                                           |     EXPLAINABILITY (XAI)      |
| S(t) -> S(t+1) -> ... S(t+K)  |                                           | KernelSHAP Attribution Engine |
| Attack Horizon & Impact Time  |                                           | Temporal Attention Heatmaps   |
+---------------+---------------+                                           +---------------+---------------+
                |                                                                           |
                +-----------------------------------+---------------------------------------+
                                                    |
                                                    v
                      +-------------------------------------------------------+
                      |         CRYPTOGRAPHIC PROOF & LEDGER ANCHOR           |
                      |     SHA-256 Merkle Hashing & Decentralized Audit      |
                      +---------------------------+---------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      |        AUTONOMOUS DECISION & SOC INTERFACE            |
                      |    Preemptive Containment Playbooks & STIX 2.1 Feeds  |
                      +-------------------------------------------------------+
```

---

## 2. Technology Stack Breakdown: What and Why

### 2.1 Core Application Framework

| Component | Technology | Specification |
| :--- | :--- | :--- |
| **Runtime Framework** | Next.js 14 | App Router architecture with React Server/Client Component isolation |
| **Language** | TypeScript 5.4 | Strict type checking (`strict: true`, `noImplicitAny: true`) |
| **Styling Engine** | TailwindCSS 3.4 | Utility-first compilation with custom HSL theme tokens |
| **Package Manager** | npm | Deterministic dependency tree locking via `package-lock.json` |

#### Architectural Rationale (The "Why"):
- **Next.js 14 App Router**: Selected over single-page client architectures (e.g., Vite/CRA) because mission-critical SOC interfaces require immediate initial render performance, deterministic routing, and zero-flicker streaming transitions. The hybrid component model allows heavy mock data services and computation to be decoupled from client rendering surfaces.
- **Strict TypeScript**: Defensive cybersecurity tools require mathematical precision. Strict type definitions enforce complete contract fidelity across network states, prediction tensors, SHAP feature scores, and blockchain transaction payloads, eliminating runtime undefined errors in production.

---

### 2.2 3D Spatial & Ambient Universe Layer

| Component | Technology | Specification |
| :--- | :--- | :--- |
| **3D Rendering Core** | Three.js (r128+) | WebGL graphics context with low-power hardware acceleration |
| **React 3D Declarative Layer** | @react-three/fiber | React renderer for Three.js scene graphs |
| **3D Utilities** | @react-three/drei | Camera controls, instanced mesh wrappers, and canvas management |
| **Global Ambient Environment** | `CyberEnvironment.tsx` | 180 multi-cluster floating nodes with dynamic proximity conduits |

#### Architectural Rationale (The "Why"):
- **Three.js & React Three Fiber**: AEGIS.AI models networks not as static tables, but as spatial topology graphs. Three.js provides the GPU-accelerated primitives required to render thousands of dynamic packet streams, network nodes, and state transitions without degrading CPU performance.
- **Shared Ambient Context vs Multiple Canvases**: Rather than mounting heavy individual WebGL contexts across pages (which exhausts GPU memory and causes canvas crash resets on multi-monitor SOC setups), AEGIS.AI mounts a single persistent ambient 3D scene globally via `AppShell.tsx`. This maintains a continuous visual atmosphere while consuming under 5% GPU utilization.

---

### 2.3 Motion, Animation, and Interaction Design

| Component | Technology | Specification |
| :--- | :--- | :--- |
| **Motion Engine** | Framer Motion (motion.dev) | Declarative spring physics and route transition coordinator |
| **Scroll Animation** | GSAP 3.12 + ScrollTrigger | High-precision scroll scrubbing on the primary hero landing experience |
| **Iconography** | Lucide React | Precision geometric SVG glyphs for security instrumentation |

#### Architectural Rationale (The "Why"):
- **Framer Motion**: Traditional CSS keyframes lack dynamic layout awareness and state interruption capabilities. Framer Motion provides physics-based springs that react smoothly to user input (e.g., drawer expansions, hover inspections, tab switching) and supports the `prefers-reduced-motion` accessibility standard.
- **GSAP ScrollTrigger**: For the 3D landing journey, GSAP provides microsecond-accurate timeline coordination between camera positions, node field expansions, and narrative text overlays.

---

### 2.4 Predictive Artificial Intelligence & World Model Representation

| Component | Concept / Model | Implementation |
| :--- | :--- | :--- |
| **Dynamic Graph Representation** | Spatio-Temporal Graph Neural Network (TGNN) | Node embeddings $h_v(t)$, edge conduits $e_{uv}(t)$ |
| **Sequence Model** | Dual-LSTM & Temporal Self-Attention | Captures long-range multi-hop reconnaissance patterns |
| **State Transition Model** | First-Order Markov Transition Kernel | $P(S(t+1) \mid S(t))$ forward state forecasting |
| **Forward Horizon** | $K$-Step Rollout Simulation | $S(t) \to S(t+1) \to \dots \to S(t+K)$ |

#### Mathematical Formulation:
Let the enterprise network at observation window $t$ be represented as an attributed graph:

$$G(t) = (V, E(t), X(t), W(t))$$

Where:
- $V$: Set of network hosts, switches, and critical assets.
- $E(t)$: Active communication conduits during window $t$.
- $X(t) \in \mathbb{R}^{|V| \times d}$: Host feature matrix (open sockets, authentication counts, privilege tiers).
- $W(t) \in \mathbb{R}^{|E| \times m}$: Edge flow telemetry (SYN rates, Shannon entropy, inter-arrival time variance).

The World Model maps the current snapshot $S(t)$ into a latent embedding space $\mathbf{z}(t)$:

$$\mathbf{z}(t) = \text{TGNN}(G(t))$$

Forward states are recursively sampled across horizon $k \in \{1, \dots, K\}$:

$$P(S(t+k) \mid S(t+k-1)) = \text{Softmax}\left(\mathbf{W}_s \cdot \text{LSTM}(\mathbf{z}(t+k-1)) + \mathbf{b}_s\right)$$

This allows AEGIS.AI to forecast lateral movement and domain escalation up to 30 minutes before malicious payloads execute.

---

### 2.5 Explainable AI (XAI) & Attribution Pipeline

| Component | Framework / Methodology | Specification |
| :--- | :--- | :--- |
| **Feature Attribution** | KernelSHAP (Shapley Additive Explanations) | Game-theoretic marginal feature contribution calculation |
| **Attention Heatmaps** | Multi-Head Temporal Self-Attention | Attention weights over past $T$ packet micro-windows |
| **Analyst Synthesis** | Natural Language Generation Pipeline | Synthesizes complex mathematical tensors into human-readable SOC summaries |

#### Mathematical Rationale:
Shapley values allocate fair payouts among features contributing to a prediction $\hat{f}(x)$:

$$\phi_i(x) = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} \left[ f_x(S \cup \{i\}) - f_x(S) \right]$$

In cybersecurity, analysts cannot trust black-box alerts. By decomposing a lateral movement forecast (+86.4%) into verified positive contributors (+94% SYN Packet Rate, +88% Port 445 SMB Activity), AEGIS.AI provides defensive justification for autonomous isolation actions.

---

### 2.6 Cryptographic Ledger & Forensic Soundness

| Component | Standard / Technology | Specification |
| :--- | :--- | :--- |
| **Digest Algorithm** | SHA-256 (FIPS 180-4) | 256-bit cryptographic digest of prediction states and feature vectors |
| **Forensic Compliance** | ISO/IEC 27037:2012 | Guidelines for identification, collection, acquisition, and preservation of digital evidence |
| **Merkle Tree Structure** | Binary Merkle Tree | Enables $O(\log n)$ cryptographic verification proofs |
| **Ledger Architecture** | Pluggable Consensus Interface | Mock service layer designed for Ethereum, Hyperledger Fabric, or private Quorum nodes |

#### Architectural Rationale (The "Why"):
- **Anti-Tampering**: In adversarial environments, an attacker who gains root privileges can alter local syslog records to hide lateral movement.
- **Decentralized Anchoring**: By computing the SHA-256 hash of every prediction event $S(t+K)$ and writing it to an immutable ledger before taking mitigation action, AEGIS.AI creates a legally admissible, mathematically verifiable chain-of-custody.

---

### 2.7 Threat Intelligence & Ecosystem Syndication

| Component | Standard | Specification |
| :--- | :--- | :--- |
| **Data Format** | STIX 2.1 (OASIS Standard) | Structured Threat Information Expression JSON schemas |
| **Transport Protocol** | TAXII 2.1 (OASIS Standard) | Trusted Automated eXchange of Intelligence Information |
| **Classification Standard** | US-CERT Traffic Light Protocol (TLP) | TLP:RED, TLP:AMBER, TLP:GREEN, TLP:WHITE access controls |
| **Taxonomy Mapping** | MITRE ATT&CK Framework | Enterprise Matrix v14 technique identifiers (e.g., T1190, T1021.002, T1071) |

---

## 3. Design System & User Experience Architecture

### 3.1 Color Palette & Visual Philosophy
The AEGIS.AI user interface utilizes a bespoke cybersecurity HSL color system designed specifically for low-light SOC environments:

- **Deep Obsidian Base (`#060a10` / `bg-cyber-950`)**: Minimizes eye strain during extended operational shifts.
- **Glassmorphic Spatial Surfaces (`backdrop-blur-xl bg-cyber-950/70`)**: Enables subtle visibility of underlying 3D network particle streams.
- **Electric Technical Cyan (`#00f0ff` / `text-cyan-400`)**: Primary telemetry conduits, system status, active focus.
- **Critical Risk Red (`#ef4444` / `text-red-400`)**: Confirmed anomalies, buffer overflow exploits, imminent lateral movement.
- **Warning Amber (`#f59e0b` / `text-amber-400`)**: Reconnaissance activity, elevated risk thresholds, pending verification.
- **Verified Emerald (`#10b981` / `text-emerald-400`)**: Cryptographically sealed blocks, benign flows, active zero-trust policies.

### 3.2 Information Distribution & Progressive Disclosure
Rather than presenting 50+ telemetry indicators simultaneously, AEGIS.AI enforces a strict 4-level progressive disclosure hierarchy:
1. **Level 1: Executive Vitals**: High-level risk score, predicted infiltration probability, impact horizon, and recommended action visible in 3 seconds.
2. **Level 2: Visual Diagram / Flow**: Interactive topology, Markov timeline, or SHAP attribution bar charts.
3. **Level 3: Contextual Inspector**: Expandable drawers and side panels displaying 5-tuple sockets, packet sizes, and hop counts upon element selection.
4. **Level 4: Raw Forensic Payload**: Hex dumps, cryptographic Merkle paths, and STIX JSON payloads available on explicit analyst request.

---

## 4. Hardware and Execution Requirements

| Environment | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **CPU** | Dual-core 2.0 GHz (x86_64 or ARM64) | Quad-core 3.0 GHz+ (Apple Silicon or Intel i7/AMD Ryzen) |
| **Memory (RAM)** | 4 GB | 8 GB+ |
| **GPU** | Integrated Graphics (WebGL 2.0 capable) | Dedicated GPU (NVIDIA GTX 1060+ / Apple M-Series GPU) |
| **Browser** | Chrome 90+, Firefox 88+, Safari 15+, Edge 90+ | Google Chrome or Chromium-based browser (hardware acceleration enabled) |
| **Node.js** | Node.js v18.17.0+ LTS | Node.js v20.x+ LTS |
| **Network** | Offline localhost capable | Broadband connection for live external telemetry feeds |
