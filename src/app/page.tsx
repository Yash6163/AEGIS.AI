'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CyberUniverse } from '@/components/3d/CyberUniverse';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Shield,
  ArrowRight,
  ChevronDown,
  Cpu,
  Database,
  Activity,
  LineChart,
  GitCommit,
  FileCode2,
  Globe2,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  Terminal,
  Radio,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  const [activeSection, setActiveSection] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Register GSAP ScrollTrigger
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const sections = gsap.utils.toArray<HTMLElement>('.cyber-scroll-section');

    const triggers = sections.map((sec, idx) => {
      return ScrollTrigger.create({
        trigger: sec,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
          if (self.isActive) {
            setActiveSection(idx + 1);
          }
        },
      });
    });

    return () => {
      triggers.forEach((t) => t.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className="relative bg-[#060a10] text-cyber-100 min-h-screen selection:bg-cyan-500 selection:text-cyber-950 font-sans">
      {/* 3D Cyber Network Universe Background Layer */}
      <CyberUniverse activeSection={activeSection} />

      {/* Floating Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 px-6 bg-cyber-950/60 backdrop-blur-md border-b border-cyber-700/50 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center shadow-cyan-glow">
            <Shield className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-mono text-sm font-bold tracking-wider text-cyber-100">
              <span>AEGIS<span className="text-cyan-400">.AI</span></span>
              <span className="text-[10px] px-1 py-0.2 bg-cyan-950 text-cyan-300 rounded border border-cyan-500/30">
                3D UNIVERSE
              </span>
            </div>
            <p className="text-[10px] font-mono text-cyber-400 tracking-tight">
              PREDICTIVE CYBER DEFENCE PLATFORM
            </p>
          </div>
        </div>

        {/* Section Indicator Pill & Quick Launch */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyber-900/80 border border-cyber-700 text-cyber-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyber-400">STAGE {activeSection}/7:</span>
            <span className="text-cyan-300 font-bold">
              {
                [
                  'CYBER NETWORK UNIVERSE',
                  'DATA INGESTION & FLOWS',
                  'TEMPORAL AI CORE ANALYSIS',
                  'FUTURE STATE PREDICTION',
                  'ATTACK TRAJECTORY GRAPH',
                  'BLOCKCHAIN EVIDENCE LOGS',
                  'SOC DASHBOARD CONSOLE',
                ][activeSection - 1]
              }
            </span>
          </div>

          <Link href="/dashboard">
            <Button variant="cyber" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              ENTER SOC DASHBOARD
            </Button>
          </Link>
        </div>
      </header>

      {/* Cinematic 7 Scroll Sections */}
      <div className="relative z-10 pointer-events-none">
        {/* =========================================================================
            SECTION 1: HERO (Complete Cyber Network Universe)
            ========================================================================= */}
        <section className="cyber-scroll-section min-h-screen flex flex-col justify-center px-6 md:px-16 pt-20">
          <div className="max-w-3xl pointer-events-auto space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono text-xs shadow-cyan-glow">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>SIH 2026 AI INNOVATION // TEMPORAL PREDICTIVE DEFENCE</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-mono font-black text-cyber-100 tracking-tight uppercase leading-none">
              Predict The Attack <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
                Before It Happens.
              </span>
            </h1>

            <p className="text-sm md:text-base text-cyber-300 font-sans leading-relaxed max-w-2xl">
              Traditional SIEM and XDR systems detect attacks only after compromise occurs.
              Aegis AI models enterprise network state transitions to forecast future attacker progression up to 30 minutes in advance, sealed on an immutable forensic blockchain.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link href="/dashboard">
                <Button variant="primary" size="md" icon={<ArrowRight className="h-4 w-4" />}>
                  LAUNCH SOC DASHBOARD
                </Button>
              </Link>
              <Link href="/upload">
                <Button variant="outline" size="md">
                  INGEST PCAP DATASET
                </Button>
              </Link>
            </div>

            {/* Quick Live SOC Telemetry Strip */}
            <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl font-mono text-xs">
              <div className="p-3 rounded-lg bg-cyber-950/70 border border-cyber-800 backdrop-blur-sm">
                <span className="text-[10px] text-cyber-500 uppercase block">Inference Horizon</span>
                <span className="text-base font-bold text-cyan-300">T+30m (K=5)</span>
              </div>
              <div className="p-3 rounded-lg bg-cyber-950/70 border border-cyber-800 backdrop-blur-sm">
                <span className="text-[10px] text-cyber-500 uppercase block">Infiltration Prob</span>
                <span className="text-base font-bold text-red-400">86.4%</span>
              </div>
              <div className="p-3 rounded-lg bg-cyber-950/70 border border-cyber-800 backdrop-blur-sm">
                <span className="text-[10px] text-cyber-500 uppercase block">Ledger Verification</span>
                <span className="text-base font-bold text-emerald-400">IBFT 2.0 SEALED</span>
              </div>
              <div className="p-3 rounded-lg bg-cyber-950/70 border border-cyber-800 backdrop-blur-sm">
                <span className="text-[10px] text-cyber-500 uppercase block">Peer Nodes Synced</span>
                <span className="text-base font-bold text-cyber-200">42 CERT Nodes</span>
              </div>
            </div>
          </div>

          <div className="pt-12 flex items-center gap-2 text-cyber-500 font-mono text-xs pointer-events-auto">
            <ChevronDown className="h-4 w-4 animate-bounce text-cyan-400" />
            <span>SCROLL TO EXPLORE 3D CYBER ARCHITECTURE</span>
          </div>
        </section>

        {/* =========================================================================
            SECTION 2: DATA INGESTION (PCAP / Flow Streams)
            ========================================================================= */}
        <section className="cyber-scroll-section min-h-screen flex flex-col justify-center px-6 md:px-16">
          <div className="max-w-xl pointer-events-auto space-y-4 p-6 rounded-xl bg-cyber-950/80 border border-cyan-500/40 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between">
              <Badge variant="cyan" size="xs">
                STAGE 2 // TELEMETRY INGESTION
              </Badge>
              <span className="text-[10px] font-mono text-cyber-500">24,510 PPS STREAM</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-mono font-bold text-cyber-100 uppercase">
              Raw PCAP & NetFlow Ingestion
            </h2>

            <p className="text-xs text-cyber-300 font-sans leading-relaxed">
              Packet headers, inter-arrival time variances, and Shannon payload entropy are extracted continuously from promiscous taps or NetFlow CSV datasets.
              Flows are structured into temporal bipartite graph micro-windows.
            </p>

            <div className="p-3 rounded-lg bg-cyber-900 border border-cyber-800 font-mono text-xs space-y-1.5">
              <div className="flex justify-between text-cyber-400 text-[11px]">
                <span>Active Ingest Buffer:</span>
                <span className="text-cyan-300 font-bold">184,290 Packets</span>
              </div>
              <div className="flex justify-between text-cyber-400 text-[11px]">
                <span>Top Protocol Mix:</span>
                <span className="text-cyber-200">TCP (78%) • SMB (14%) • DNS (8%)</span>
              </div>
              <div className="flex justify-between text-cyber-400 text-[11px]">
                <span>Entropy Anomaly:</span>
                <span className="text-amber-300 font-bold">&gt; 7.82 bits/byte (High)</span>
              </div>
            </div>

            <Link href="/upload" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 underline pt-1">
              <span>View Data Ingestion Portal</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        {/* =========================================================================
            SECTION 3: AI ANALYSIS (Central Neural Core)
            ========================================================================= */}
        <section className="cyber-scroll-section min-h-screen flex flex-col justify-center px-6 md:px-16 items-end">
          <div className="max-w-xl pointer-events-auto space-y-4 p-6 rounded-xl bg-cyber-950/80 border border-cyan-500/40 backdrop-blur-md shadow-2xl text-right">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-cyber-500">TGNN + TEMPORAL ATTENTION</span>
              <Badge variant="mock" size="xs">
                STAGE 3 // AI ANALYSIS CORE
              </Badge>
            </div>

            <h2 className="text-2xl md:text-3xl font-mono font-bold text-cyber-100 uppercase">
              Temporal Graph Neural Network
            </h2>

            <p className="text-xs text-cyber-300 font-sans leading-relaxed">
              Camera zooms into the central intelligence core. Multi-head cross-attention models covariance between edge weights, SYN burst rates, and host criticality to formulate topological state representations.
            </p>

            <div className="p-3 rounded-lg bg-cyber-900 border border-cyber-800 font-mono text-xs space-y-1.5 text-left">
              <div className="flex justify-between text-cyber-400 text-[11px]">
                <span>Model Architecture:</span>
                <span className="text-cyan-300">NeuroCyber-TGNN-v3.4</span>
              </div>
              <div className="flex justify-between text-cyber-400 text-[11px]">
                <span>Temporal Attention Heads:</span>
                <span className="text-cyber-200">4 Active Cross-Heads</span>
              </div>
              <div className="flex justify-between text-cyber-400 text-[11px]">
                <span>Feature Importance:</span>
                <span className="text-red-400 font-bold">SYN Rate (+94%) • Port 445 (+88%)</span>
              </div>
            </div>

            <Link href="/explainability" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 underline pt-1">
              <span>Inspect SHAP & Attention Weights</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        {/* =========================================================================
            SECTION 4: FUTURE STATE PREDICTION (K-Step Forward Simulation)
            ========================================================================= */}
        <section className="cyber-scroll-section min-h-screen flex flex-col justify-center px-6 md:px-16">
          <div className="max-w-xl pointer-events-auto space-y-4 p-6 rounded-xl bg-cyber-950/80 border border-cyan-500/40 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between">
              <Badge variant="high" size="xs">
                STAGE 4 // K-STEP SIMULATION
              </Badge>
              <span className="text-[10px] font-mono text-cyan-400 font-bold">P(S(t+1) | S(t))</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-mono font-bold text-cyber-100 uppercase">
              Future State Forward Simulation
            </h2>

            <p className="text-xs text-cyber-300 font-sans leading-relaxed">
              The AI engine simulates sequential state transitions across future observation windows:
              <br />
              <code className="text-cyan-300 font-mono text-[11px]">S(t) &rarr; S(t+1) &rarr; S(t+2) &rarr; S(t+3) &rarr; S(t+K)</code>.
              Defenders gain the decision advantage to isolate critical assets prior to execution.
            </p>

            <div className="grid grid-cols-4 gap-2 font-mono text-center text-xs">
              <div className="p-2 rounded bg-cyber-900 border border-cyber-800">
                <span className="text-[9px] text-cyber-500 block">T+0m</span>
                <span className="text-emerald-400 font-bold">Recon</span>
              </div>
              <div className="p-2 rounded bg-cyber-900 border border-cyber-800">
                <span className="text-[9px] text-cyber-500 block">T+5m</span>
                <span className="text-amber-400 font-bold">Access</span>
              </div>
              <div className="p-2 rounded bg-cyber-900 border border-red-500/50">
                <span className="text-[9px] text-red-400 block">T+15m</span>
                <span className="text-red-300 font-bold">Lateral</span>
              </div>
              <div className="p-2 rounded bg-cyber-900 border border-red-500">
                <span className="text-[9px] text-red-400 block">T+30m</span>
                <span className="text-red-400 font-bold">Exfil</span>
              </div>
            </div>

            <Link href="/forecast" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 underline pt-1">
              <span>Configure K-Step Forward Simulator</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        {/* =========================================================================
            SECTION 5: ATTACK PROGRESSION (MITRE Kill-Chain Trajectory)
            ========================================================================= */}
        <section className="cyber-scroll-section min-h-screen flex flex-col justify-center px-6 md:px-16 items-end">
          <div className="max-w-xl pointer-events-auto space-y-4 p-6 rounded-xl bg-cyber-950/80 border border-red-500/50 backdrop-blur-md shadow-2xl text-right">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-red-400 font-bold animate-pulse">ATTACK TRAJECTORY DETECTED</span>
              <Badge variant="critical" size="xs">
                STAGE 5 // KILL-CHAIN PATH
              </Badge>
            </div>

            <h2 className="text-2xl md:text-3xl font-mono font-bold text-red-300 uppercase">
              Emerging Adversary Trajectory
            </h2>

            <p className="text-xs text-cyber-300 font-sans leading-relaxed">
              The 3D environment illuminates the suspicious conduit in red.
              The kill-chain emerges across network boundaries: External Ingress &rarr; Gateway &rarr; SMB FileServer &rarr; Domain Controller DC-01.
            </p>

            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/40 font-mono text-xs space-y-1 text-left">
              <div className="flex justify-between text-[11px]">
                <span className="text-cyber-400">Suspected Threat:</span>
                <span className="text-red-300 font-bold">APT29 / Nobelium Emulation</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-cyber-400">Target Asset:</span>
                <span className="text-cyber-200">DC-01 (10.240.12.10)</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-cyber-400">Exploit Pattern:</span>
                <span className="text-amber-300 font-bold">CVE-2020-0796 (SMBGhost)</span>
              </div>
            </div>

            <Link href="/attack-path" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 underline pt-1">
              <span>View Interactive MITRE Attack Path</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        {/* =========================================================================
            SECTION 6: BLOCKCHAIN EVIDENCE (Tamper-Proof Ledger)
            ========================================================================= */}
        <section className="cyber-scroll-section min-h-screen flex flex-col justify-center px-6 md:px-16">
          <div className="max-w-xl pointer-events-auto space-y-4 p-6 rounded-xl bg-cyber-950/80 border border-emerald-500/50 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between">
              <Badge variant="verified" size="xs">
                STAGE 6 // IMMUTABLE LEDGER
              </Badge>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">BLOCK #4892184</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-mono font-bold text-cyber-100 uppercase">
              Cryptographic Evidence Anchoring
            </h2>

            <p className="text-xs text-cyber-300 font-sans leading-relaxed">
              Prediction vectors, model version cards, and observed flow tensors are hashed into an immutable SHA-256 digest and sealed across decentralized validator nodes.
              Alerts cannot be deleted, tampered with, or repudiated.
            </p>

            <div className="p-3 rounded-lg bg-cyber-900 border border-cyber-800 font-mono text-xs space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-cyber-400">Prediction SHA-256:</span>
                <span className="text-cyan-300">0x8f3c71a8...2c7339a1</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-cyber-400">Consensus Engine:</span>
                <span className="text-emerald-400 font-semibold">IBFT 2.0 (5/5 Quorum)</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-cyber-400">Forensic Standard:</span>
                <span className="text-cyber-200">ISO/IEC 27037 Compliant</span>
              </div>
            </div>

            <Link href="/blockchain" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 underline pt-1">
              <span>Inspect On-Chain Evidence Proofs</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        {/* =========================================================================
            SECTION 7: DASHBOARD REVEAL & CALL TO ACTION
            ========================================================================= */}
        <section className="cyber-scroll-section min-h-screen flex flex-col justify-center px-6 md:px-16">
          <div className="max-w-4xl mx-auto pointer-events-auto space-y-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-mono text-xs shadow-cyan-glow">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>STAGE 7 // ENTER OPERATIONAL SOC COMMAND CENTER</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-mono font-black text-cyber-100 uppercase tracking-tight">
              Ready for Live Defender Operations
            </h2>

            <p className="text-sm md:text-base text-cyber-300 font-sans max-w-2xl mx-auto leading-relaxed">
              Transition from the 3D Cyber Universe directly into the functional SOC platform.
              Monitor real-time network states, execute preemptive micro-segmentation, and syndicate threat intelligence.
            </p>

            {/* Launch CTA */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link href="/dashboard">
                <Button variant="primary" size="md" icon={<ArrowRight className="h-4 w-4" />}>
                  OPEN SOC DASHBOARD CONSOLE
                </Button>
              </Link>
              <Link href="/forecast">
                <Button variant="cyber" size="md" icon={<LineChart className="h-4 w-4" />}>
                  RUN K-STEP SIMULATOR
                </Button>
              </Link>
            </div>

            {/* Grid of All 10 Modules */}
            <div className="pt-8 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-left font-mono text-xs">
              <Link href="/dashboard" className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 hover:border-cyan-400 transition-colors">
                <span className="text-cyan-400 font-bold block mb-0.5">/dashboard</span>
                <span className="text-[11px] text-cyber-400 font-sans">SOC Command Console</span>
              </Link>
              <Link href="/upload" className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 hover:border-cyan-400 transition-colors">
                <span className="text-cyan-400 font-bold block mb-0.5">/upload</span>
                <span className="text-[11px] text-cyber-400 font-sans">PCAP Data Ingestion</span>
              </Link>
              <Link href="/analysis" className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 hover:border-cyan-400 transition-colors">
                <span className="text-cyan-400 font-bold block mb-0.5">/analysis</span>
                <span className="text-[11px] text-cyber-400 font-sans">Flow & Entropy Sniffer</span>
              </Link>
              <Link href="/forecast" className="p-3 rounded-lg bg-cyber-950/80 border border-cyan-400 text-cyan-300 font-bold shadow-cyan-glow/20">
                <span className="block mb-0.5">/forecast</span>
                <span className="text-[11px] text-cyber-300 font-sans">K-Step Forward Sim</span>
              </Link>
              <Link href="/attack-path" className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 hover:border-cyan-400 transition-colors">
                <span className="text-cyan-400 font-bold block mb-0.5">/attack-path</span>
                <span className="text-[11px] text-cyber-400 font-sans">MITRE Kill-Chain Graph</span>
              </Link>
              <Link href="/explainability" className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 hover:border-cyan-400 transition-colors">
                <span className="text-cyan-400 font-bold block mb-0.5">/explainability</span>
                <span className="text-[11px] text-cyber-400 font-sans">SHAP & Attention XAI</span>
              </Link>
              <Link href="/blockchain" className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 hover:border-cyan-400 transition-colors">
                <span className="text-cyan-400 font-bold block mb-0.5">/blockchain</span>
                <span className="text-[11px] text-cyber-400 font-sans">Tamper-Proof Ledger</span>
              </Link>
              <Link href="/threat-intelligence" className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 hover:border-cyan-400 transition-colors">
                <span className="text-cyan-400 font-bold block mb-0.5">/threat-intel</span>
                <span className="text-[11px] text-cyber-400 font-sans">STIX/TAXII Federation</span>
              </Link>
              <Link href="/competitors" className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 hover:border-cyan-400 transition-colors">
                <span className="text-cyan-400 font-bold block mb-0.5">/competitors</span>
                <span className="text-[11px] text-cyber-400 font-sans">SIH Winning Matrix</span>
              </Link>
              <Link href="/settings" className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 hover:border-cyan-400 transition-colors">
                <span className="text-cyan-400 font-bold block mb-0.5">/settings</span>
                <span className="text-[11px] text-cyber-400 font-sans">Engine & Microservices</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
