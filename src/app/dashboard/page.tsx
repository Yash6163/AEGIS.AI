'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  GitBranch,
  Layers,
  Database,
  ArrowRight,
  Search,
  Lock,
  Cpu,
  RefreshCw,
  Server,
  Zap,
  ChevronRight,
  LineChart,
  Sparkles,
  Radio,
  Sliders,
  FileCheck,
} from 'lucide-react';
import { services } from '@/services';
import {
  mockNetworkState,
  mockPredictionSummary,
  mockFutureSteps,
  mockMitreProgression,
  mockTopFeatures,
  mockBlockchainEvidence,
  mockThreatEvents,
} from '@/services/mock/mockData';
import { CurrentNetworkState } from '@/types/network';
import { AttackPredictionSummary, FutureStateStep } from '@/types/prediction';
import { MitreAttackProgression } from '@/types/mitre';
import { TopFeatureContribution } from '@/types/explainability';
import { BlockchainEvidence, ThreatEventItem } from '@/types/blockchain';

import { CyberPanel } from '@/components/ui/CyberPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useCyberToast } from '@/components/ui/CyberToast';

type DashboardTab = 'overview' | 'forecast' | 'reasoning' | 'network' | 'ledger';

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [networkState, setNetworkState] = useState<CurrentNetworkState>(mockNetworkState);
  const [prediction, setPrediction] = useState<AttackPredictionSummary>(mockPredictionSummary);
  const [futureSteps, setFutureSteps] = useState<FutureStateStep[]>(mockFutureSteps);
  const [mitreProgression, setMitreProgression] = useState<MitreAttackProgression>(mockMitreProgression);
  const [topFeatures, setTopFeatures] = useState<TopFeatureContribution[]>(mockTopFeatures);
  const [blockchainEvidence, setBlockchainEvidence] = useState<BlockchainEvidence>(mockBlockchainEvidence);
  const [threatEvents, setThreatEvents] = useState<ThreatEventItem[]>(mockThreatEvents);

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isVerifyingProof, setIsVerifyingProof] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState<boolean | null>(null);
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [eventSearch, setEventSearch] = useState('');
  const { showToast } = useCyberToast();

  const refreshDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [netRes, predRes, timelineRes, mitreRes, featRes, chainRes, eventsRes] =
        await Promise.all([
          services.getNetworkService().getCurrentState(),
          services.getPredictionService().getLatestPrediction(),
          services.getPredictionService().getFutureTimeline(5),
          services.getPredictionService().getMitreProgression(),
          services.getExplainabilityService().getTopFeatures(),
          services.getBlockchainService().getLatestEvidence(),
          services.getBlockchainService().getThreatEvents(8),
        ]);

      if (!netRes.success || !predRes.success) {
        throw new Error('Service layer returned error during telemetry acquisition');
      }

      setNetworkState(netRes.data);
      setPrediction(predRes.data);
      setFutureSteps(timelineRes.data);
      setMitreProgression(mitreRes.data);
      setTopFeatures(featRes.data);
      setBlockchainEvidence(chainRes.data);
      setThreatEvents(eventsRes.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh telemetry from service registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshDashboardData();
  }, []);

  const handleVerifyOnLedger = async () => {
    if (!blockchainEvidence) return;
    setIsVerifyingProof(true);
    setVerifiedSuccess(null);

    const result = await services
      .getBlockchainService()
      .verifyEvidenceHash(blockchainEvidence.predictionHash);

    setIsVerifyingProof(false);
    setVerifiedSuccess(result.data.isValid);
    setTimeout(() => {
      setVerifiedSuccess(null);
    }, 4000);
  };

  if (loading) {
    return (
      <div className="py-16 max-w-4xl mx-auto">
        <LoadingState
          label="SYNCHRONIZING SOC COMMAND TELEMETRY"
          subtext="Aggregating network state tensors, forward predictions, and ledger verification..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 max-w-4xl mx-auto">
        <ErrorState
          title="FAILED TO CONNECT TO PREDICTION SERVICE"
          message={error || 'Unable to populate dashboard metrics'}
          onRetry={refreshDashboardData}
        />
      </div>
    );
  }

  const filteredThreatEvents = threatEvents.filter(
    (e) =>
      e.event.toLowerCase().includes(eventSearch.toLowerCase()) ||
      e.sourceIp.includes(eventSearch) ||
      e.attackStage.toLowerCase().includes(eventSearch.toLowerCase())
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 pb-16 relative z-10 font-sans">
      {/* 1. Sleek Minimal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-800/40 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-cyan-glow/20">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-mono font-bold text-cyber-100 uppercase tracking-wide">
                SOC Command & Autonomous Defense
              </h1>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-xs text-cyber-400 font-sans">
              Autonomous predictive defence engine &bull; Active horizon: <span className="text-cyan-300 font-mono">+30m</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link href="/forecast">
            <Button variant="outline" size="sm" icon={<LineChart className="h-3.5 w-3.5" />}>
              SIMULATE HORIZON
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            icon={<Lock className="h-3.5 w-3.5" />}
            onClick={() =>
              showToast(
                'Preemptive Containment Executed',
                `Autonomous micro-segmentation enforced on subnet ${prediction.targetSubnet}. Zero-trust policy engaged.`,
                'critical'
              )
            }
          >
            EXECUTE DEFENDER ACTION
          </Button>
        </div>
      </div>

      {/* 2. Unified Executive Vitals Ribbon (Consolidated & Minimalist) */}
      <div className="rounded-xl bg-cyber-950/70 border border-cyber-800/80 backdrop-blur-xl p-4 shadow-xl">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 divide-y md:divide-y-0 md:divide-x divide-cyber-850/80">
          {/* Metric 1: Current Risk */}
          <div className="pt-2 md:pt-0 md:px-3 first:px-0">
            <span className="text-[10px] font-mono text-cyber-500 uppercase tracking-wider block">
              CURRENT THREAT // S(t)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-mono font-bold text-amber-400">
                {networkState.currentRiskScore}
              </span>
              <span className="text-xs font-mono text-cyber-500">/ 100</span>
              <Badge variant="high" size="xs">ELEVATED</Badge>
            </div>
            <span className="text-xs text-cyber-300 font-sans mt-0.5 block truncate">
              {networkState.currentAttackStage}
            </span>
          </div>

          {/* Metric 2: Predicted Future */}
          <div className="pt-2 md:pt-0 md:px-3">
            <span className="text-[10px] font-mono text-cyber-500 uppercase tracking-wider block">
              PREDICTED INFILTRATION // S(t+K)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-mono font-bold text-red-400">
                {prediction.infiltrationProbability}%
              </span>
              <Badge variant="critical" size="xs">LATERAL PIVOT</Badge>
            </div>
            <span className="text-xs text-red-300 font-sans mt-0.5 block truncate">
              T1190 SMBGhost Exploit
            </span>
          </div>

          {/* Metric 3: Time To Impact */}
          <div className="pt-2 md:pt-0 md:px-3">
            <span className="text-[10px] font-mono text-cyber-500 uppercase tracking-wider block">
              TIME TO CRITICAL IMPACT
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-mono font-bold text-amber-300">
                {prediction.estimatedTimeToImpactMinutes} min
              </span>
              <span className="text-[10px] font-mono text-cyber-400">T+14.5m</span>
            </div>
            <span className="text-xs text-cyber-300 font-sans mt-0.5 block truncate">
              Target: Domain Controller
            </span>
          </div>

          {/* Metric 4: Network Health */}
          <div className="pt-2 md:pt-0 md:px-3">
            <span className="text-[10px] font-mono text-cyber-500 uppercase tracking-wider block">
              NETWORK STABILITY
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-mono font-bold text-cyber-100">
                {networkState.networkHealth}%
              </span>
              <span className="text-xs font-mono text-amber-400">14% deg</span>
            </div>
            <span className="text-xs text-cyber-300 font-sans mt-0.5 block truncate">
              {networkState.activeFlows.toLocaleString()} flows &bull; {networkState.suspiciousFlows} flagged
            </span>
          </div>

          {/* Metric 5: Recommended Action */}
          <div className="pt-2 md:pt-0 md:px-3 col-span-2 md:col-span-1">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">
              PREEMPTIVE PLAYBOOK
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-sm font-mono font-bold text-emerald-300 truncate">
                Quarantine Port 445
              </span>
            </div>
            <span className="text-xs text-cyber-300 font-sans mt-0.5 block truncate">
              Subnet Isolation &bull; Zero-Trust
            </span>
          </div>
        </div>
      </div>

      {/* 3. Distributed View Switcher Tabs (Reduces On-Screen Clutter) */}
      <div className="flex items-center gap-1.5 border-b border-cyber-800/60 pb-2 overflow-x-auto no-scrollbar font-mono text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'overview'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-cyan-glow/20 font-bold'
              : 'text-cyber-400 hover:text-cyber-200 hover:bg-cyber-900/60 border border-transparent'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>01. EXECUTIVE OVERVIEW</span>
        </button>

        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'forecast'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-cyan-glow/20 font-bold'
              : 'text-cyber-400 hover:text-cyber-200 hover:bg-cyber-900/60 border border-transparent'
          }`}
        >
          <GitBranch className="h-3.5 w-3.5" />
          <span>02. ATTACK FORECAST & TRAJECTORY</span>
        </button>

        <button
          onClick={() => setActiveTab('reasoning')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'reasoning'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-cyan-glow/20 font-bold'
              : 'text-cyber-400 hover:text-cyber-200 hover:bg-cyber-900/60 border border-transparent'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>03. AI REASONING (SHAP)</span>
        </button>

        <button
          onClick={() => setActiveTab('network')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'network'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-cyan-glow/20 font-bold'
              : 'text-cyber-400 hover:text-cyber-200 hover:bg-cyber-900/60 border border-transparent'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>04. NETWORK TELEMETRY</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'ledger'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-cyan-glow/20 font-bold'
              : 'text-cyber-400 hover:text-cyber-200 hover:bg-cyber-900/60 border border-transparent'
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>05. AUDIT & LEDGER PROOF</span>
        </button>
      </div>

      {/* 4. Distributed View Panels */}
      <AnimatePresence mode="wait">
        {/* TAB 1: EXECUTIVE OVERVIEW */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Left: Next Attack State & Immediate Action */}
            <div className="lg:col-span-6 space-y-4">
              <CyberPanel
                title="Imminent Attack Escalation & Defense Playbook"
                subtitle="Next anticipated state transition modeled by TGNN World Model"
                accent="red"
              >
                <div className="space-y-4 font-mono text-xs">
                  <div className="p-3.5 rounded-xl bg-cyber-950/80 border border-red-500/40 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-cyber-400 uppercase">Target Asset Under Siege</span>
                      <Badge variant="critical" size="xs">TIER 0 ACTIVE DIRECTORY</Badge>
                    </div>
                    <div className="text-sm font-bold text-cyber-100 font-sans">
                      {prediction.targetSubnet} &bull; DC-EAST-01 (10.240.12.2)
                    </div>
                    <p className="text-xs text-cyber-300 font-sans leading-relaxed">
                      Adversary utilizing SMBGhost (CVE-2020-0796) compression buffer overflow to pivot from DMZ staging into enterprise domain controller.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 uppercase font-bold">Autonomous Containment Ready</span>
                      <span className="text-cyber-400 text-[10px]">Zero False-Positive Confidence: 92.1%</span>
                    </div>
                    <div className="text-xs text-cyber-200 font-sans">
                      Dispatches temporary IP-table drop on TCP:445 and revokes Kerberos tickets for compromised staging service account.
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-cyber-400">Estimated containment window: 14.5 min</span>
                      <Button
                        variant="primary"
                        size="xs"
                        icon={<Lock className="h-3 w-3" />}
                        onClick={() =>
                          showToast(
                            'Playbook Executed',
                            'Target subnet isolated. Firewall micro-rules staged.',
                            'success'
                          )
                        }
                      >
                        DISPATCH NOW
                      </Button>
                    </div>
                  </div>
                </div>
              </CyberPanel>
            </div>

            {/* Right: Real-time Incident Feed (Top 4 Clean) */}
            <div className="lg:col-span-6 space-y-4">
              <CyberPanel
                title="Priority Security Incidents"
                subtitle="Recent high-fidelity detections awaiting analyst resolution"
                accent="cyan"
              >
                <div className="space-y-2.5 font-mono text-xs">
                  {threatEvents.slice(0, 4).map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-lg bg-cyber-950/70 border border-cyber-800 hover:border-cyber-700 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={evt.severity} size="xs">{evt.severity}</Badge>
                          <span className="font-bold text-cyber-100 truncate text-xs font-sans">
                            {evt.event}
                          </span>
                        </div>
                        <div className="text-[11px] text-cyber-400 mt-1 truncate">
                          {evt.sourceIp} &rarr; {evt.destIp} &bull; Stage: <span className="text-cyan-300">{evt.attackStage}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-cyber-500 block">{evt.timestamp}</span>
                        <span className="text-[10px] font-semibold text-emerald-400 mt-0.5 block">
                          {evt.actionTaken}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CyberPanel>
            </div>
          </motion.div>
        )}

        {/* TAB 2: ATTACK FORECAST & TRAJECTORY */}
        {activeTab === 'forecast' && (
          <motion.div
            key="forecast"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            {/* Forward Markov State Progression */}
            <CyberPanel
              title="Forward Markov State Progression: S(t) → S(t+1) → S(t+2) → S(t+K)"
              subtitle="Multi-step predictive horizon estimating future attack progression windows"
              accent="cyan"
              actions={
                <Link href="/forecast">
                  <span className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    Full Horizon Simulation &rarr;
                  </span>
                </Link>
              }
            >
              <div className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {futureSteps.map((step) => {
                    const isSelected = selectedStep === step.step;
                    const isCurrent = step.step === 0;

                    return (
                      <div
                        key={step.step}
                        onClick={() => setSelectedStep(step.step)}
                        className={`cursor-pointer rounded-lg p-3 transition-all border select-none ${
                          isSelected
                            ? 'bg-cyber-850 border-cyan-400 shadow-cyan-glow/30 ring-1 ring-cyan-400/40'
                            : 'bg-cyber-950/80 border-cyber-800 hover:border-cyber-700 hover:bg-cyber-900'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className={`font-bold ${isCurrent ? 'text-emerald-400' : 'text-cyan-400'}`}>
                            {step.stepLabel}
                          </span>
                          <span className="text-[10px] text-cyber-500">+{step.relativeTimeMinutes}m</span>
                        </div>
                        <span className="text-[11px] text-cyber-100 truncate block font-semibold">
                          {step.predictedStage}
                        </span>
                        <div className="mt-2 pt-1.5 border-t border-cyber-800/80 flex items-center justify-between text-[10px]">
                          <span className="text-cyber-500">Risk Score</span>
                          <span className={`font-bold ${step.riskScore > 85 ? 'text-red-400' : 'text-amber-400'}`}>
                            {step.riskScore}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {futureSteps[selectedStep] && (
                  <div className="p-4 rounded-xl bg-cyber-950/90 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-bold text-sm">
                          {futureSteps[selectedStep].stepLabel} (+{futureSteps[selectedStep].relativeTimeMinutes}m Horizon):
                        </span>
                        <span className="text-cyber-100 font-semibold">{futureSteps[selectedStep].predictedStage}</span>
                        <Badge variant="high" size="xs">
                          {((futureSteps[selectedStep].transitionProbability || 0.85) * 100).toFixed(0)}% Probability
                        </Badge>
                      </div>
                      <div className="text-xs text-cyber-300 font-sans mt-1">
                        Vulnerable Host: <span className="text-cyber-100 font-mono">{futureSteps[selectedStep].vulnerableAsset}</span> &bull;{' '}
                        Autonomous Action: <span className="text-amber-300 font-mono">{futureSteps[selectedStep].recommendedAction}</span>
                      </div>
                    </div>
                    <Button
                      variant="cyber"
                      size="sm"
                      onClick={() =>
                        showToast(
                          'Preemptive Playbook Dispatched',
                          `Playbook executed for ${futureSteps[selectedStep].vulnerableAsset}.`,
                          'warning'
                        )
                      }
                    >
                      DISPATCH PLAYBOOK
                    </Button>
                  </div>
                )}
              </div>
            </CyberPanel>

            {/* MITRE Kill-Chain Trajectory */}
            <CyberPanel
              title="MITRE ATT&CK Kill-Chain Progression"
              subtitle="Reconnaissance → Initial Access → Lateral Movement → C2 → Exfiltration"
              accent="red"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
                {mitreProgression.stages.map((stageNode, idx) => {
                  const isCurrent = stageNode.status === 'current';
                  const isPredicted = stageNode.status === 'predicted';
                  const isPassed = stageNode.status === 'passed';

                  return (
                    <div
                      key={stageNode.phase}
                      className={`rounded-lg p-3 border transition-all ${
                        isCurrent
                          ? 'bg-red-950/40 border-red-500 shadow-red-glow/20'
                          : isPredicted
                          ? 'bg-amber-950/30 border-amber-500 shadow-amber-glow/10'
                          : isPassed
                          ? 'bg-cyber-900/60 border-cyber-700 opacity-80'
                          : 'bg-cyber-950/50 border-cyber-800/80 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 text-[10px]">
                        <span className="text-cyber-500 font-bold">#{idx + 1}</span>
                        {isCurrent && <Badge variant="critical" size="xs" pulse>CURRENT</Badge>}
                        {isPredicted && <Badge variant="high" size="xs">PREDICTED</Badge>}
                        {isPassed && <span className="text-emerald-400 font-bold">DONE</span>}
                      </div>
                      <h4 className="font-bold text-cyber-100 text-xs truncate uppercase">{stageNode.phase}</h4>
                      <span className="text-[10px] text-cyan-300 block truncate mt-0.5">{stageNode.techniqueId}</span>
                      <div className="mt-2 pt-1.5 border-t border-cyber-800 flex justify-between text-[10px]">
                        <span className="text-cyber-500">Transition</span>
                        <span className={`font-bold ${isCurrent ? 'text-red-400' : isPredicted ? 'text-amber-400' : 'text-cyber-300'}`}>
                          {(stageNode.probability * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CyberPanel>
          </motion.div>
        )}

        {/* TAB 3: AI REASONING (SHAP) */}
        {activeTab === 'reasoning' && (
          <motion.div
            key="reasoning"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Left: SHAP Attribution Bars */}
            <div className="lg:col-span-7 space-y-4">
              <CyberPanel
                title="Feature Contributions (SHAP Attribution)"
                subtitle="Observed anomalous features driving the forward prediction"
                accent="cyan"
              >
                <div className="space-y-3 font-mono text-xs">
                  {topFeatures.map((feat, idx) => (
                    <div key={feat.featureName} className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-cyber-200 font-bold">{idx + 1}. {feat.featureName}</span>
                        <span className="font-bold text-red-400">+{feat.contributionScore.toFixed(0)}%</span>
                      </div>
                      <ProgressBar
                        value={feat.contributionScore}
                        variant={feat.contributionScore > 80 ? 'red' : 'amber'}
                        size="xs"
                      />
                      <div className="flex justify-between text-[10px] text-cyber-400 font-sans pt-0.5">
                        <span>Baseline: nominal range</span>
                        <span className="text-cyan-300">Observation: anomalous spike</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CyberPanel>
            </div>

            {/* Right: SOC Analyst Plain-Language Synthesis */}
            <div className="lg:col-span-5 space-y-4">
              <CyberPanel
                title="Analyst Executive Synthesis"
                subtitle="Interpretable narrative generated by XAI pipeline"
                accent="cyan"
              >
                <div className="space-y-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-cyber-200 font-sans leading-relaxed">
                    &ldquo;High SYN packet rate (480 pps) combined with abnormal port 445 SMB traffic and Shannon entropy variance significantly increased the probability of imminent lateral movement towards the Domain Controller.&rdquo;
                  </div>

                  <div className="p-3.5 rounded-lg bg-cyber-950/80 border border-cyber-800 space-y-2 text-xs">
                    <span className="text-cyber-400 text-[10px] uppercase font-bold block">
                      Explainability Model Specs:
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-cyber-900/60 border border-cyber-850">
                        <span className="text-cyber-500 block text-[9px]">Explainer:</span>
                        <span className="text-cyber-200">KernelSHAP + Attention</span>
                      </div>
                      <div className="p-2 rounded bg-cyber-900/60 border border-cyber-850">
                        <span className="text-cyber-500 block text-[9px]">Confidence:</span>
                        <span className="text-emerald-400 font-bold">92.1% calibrated</span>
                      </div>
                    </div>
                  </div>

                  <Link href="/explainability">
                    <Button variant="cyber" size="sm" className="w-full">
                      OPEN COMPREHENSIVE XAI WORKBENCH &rarr;
                    </Button>
                  </Link>
                </div>
              </CyberPanel>
            </div>
          </motion.div>
        )}

        {/* TAB 4: NETWORK TELEMETRY */}
        {activeTab === 'network' && (
          <motion.div
            key="network"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-cyber-950/80 border border-cyber-800">
                <span className="text-cyber-500 text-[10px] uppercase block">Total Packets Ingested</span>
                <span className="text-xl font-bold text-cyber-100 block mt-1">
                  {networkState.totalPacketsObserved.toLocaleString()}
                </span>
                <span className="text-cyan-400 text-[10px] font-sans block mt-0.5">Ingress stream active</span>
              </div>

              <div className="p-3.5 rounded-xl bg-cyber-950/80 border border-cyber-800">
                <span className="text-cyber-500 text-[10px] uppercase block">Interface Bandwidth</span>
                <span className="text-xl font-bold text-cyber-100 block mt-1">
                  {networkState.bandwidthMbps} Mbps
                </span>
                <span className="text-emerald-400 text-[10px] font-sans block mt-0.5">Line capacity optimal</span>
              </div>

              <div className="p-3.5 rounded-xl bg-cyber-950/80 border border-cyber-800">
                <span className="text-cyber-500 text-[10px] uppercase block">Active Ingress Sockets</span>
                <span className="text-xl font-bold text-cyber-100 block mt-1">
                  {networkState.activeFlows.toLocaleString()}
                </span>
                <span className="text-cyber-400 text-[10px] font-sans block mt-0.5">5-tuple flow tracking</span>
              </div>

              <div className="p-3.5 rounded-xl bg-cyber-950/80 border border-red-500/40">
                <span className="text-red-400 text-[10px] uppercase block">SYN Flood Rate</span>
                <span className="text-xl font-bold text-red-400 block mt-1">
                  {networkState.synFloodRate} pps
                </span>
                <span className="text-red-300 text-[10px] font-sans block mt-0.5">Anomaly threshold exceeded</span>
              </div>
            </div>

            <CyberPanel
              title="Interface Conduits & Flow Decomposition"
              subtitle="Real-time telemetry extracted from active enterprise network adapters"
              accent="cyan"
              actions={
                <Link href="/analysis">
                  <span className="text-xs font-mono text-cyan-400 hover:text-cyan-300">
                    Open Deep Traffic Analyzer &rarr;
                  </span>
                </Link>
              }
            >
              <div className="p-4 rounded-xl bg-cyber-950/80 border border-cyber-800 text-xs font-mono flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-cyber-100">Live Ingress Capture: cve-2020-0796-smbv3-ghost-apt29.pcap</div>
                  <div className="text-cyber-400 text-[11px] font-sans mt-0.5">
                    Dissecting 5-tuple sockets, Shannon payload entropy, and inter-arrival time variances into World Model tensors.
                  </div>
                </div>
                <Link href="/analysis">
                  <Button variant="primary" size="sm">
                    INSPECT NETWORK FLOWS
                  </Button>
                </Link>
              </div>
            </CyberPanel>
          </motion.div>
        )}

        {/* TAB 5: AUDIT & LEDGER PROOF */}
        {activeTab === 'ledger' && (
          <motion.div
            key="ledger"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            {/* Cryptographic State Seal */}
            <CyberPanel
              title="Cryptographic State Seal (Blockchain Anchor)"
              subtitle="Tamper-proof prediction state committed to decentralized consensus ledger"
              accent="emerald"
              actions={
                <Button
                  variant="cyber"
                  size="xs"
                  onClick={handleVerifyOnLedger}
                  isLoading={isVerifyingProof}
                  icon={<Lock className="h-3.5 w-3.5" />}
                >
                  VERIFY PROOF ON CHAIN
                </Button>
              }
            >
              {verifiedSuccess !== null && (
                <div className={`mb-3 p-3 rounded text-xs font-mono flex items-center gap-2 ${
                  verifiedSuccess ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300' : 'bg-red-950/80 border border-red-500 text-red-300'
                }`}>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Cryptographic Merkle Proof Validated against Block #{blockchainEvidence.blockNumber}.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800">
                  <span className="text-cyber-500 text-[10px] uppercase block">Prediction Evidence Hash</span>
                  <span className="text-cyan-300 break-all select-all font-semibold block text-[11px] mt-1">
                    {blockchainEvidence.predictionHash}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800">
                  <span className="text-cyber-500 text-[10px] uppercase block">Blockchain Consensus Record</span>
                  <div className="flex justify-between text-cyber-200 mt-1 text-[11px]">
                    <span>Block: #{blockchainEvidence.blockNumber}</span>
                    <span className="text-emerald-400 font-bold">{blockchainEvidence.verificationStatus}</span>
                  </div>
                </div>
              </div>
            </CyberPanel>

            {/* Complete Threat Event Ledger */}
            <CyberPanel
              title="Security Event Log & Forensic Audit Trail"
              subtitle="Real-time observed flow events and ledger transactions"
              actions={
                <div className="relative">
                  <Search className="h-3 w-3 text-cyber-500 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Search event / IP..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="bg-cyber-950 border border-cyber-800 rounded px-2 py-1 pl-7 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 w-36 sm:w-44"
                  />
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-cyber-800 bg-cyber-950/60 text-cyber-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Threat Event</th>
                      <th className="py-2.5 px-3">Stage</th>
                      <th className="py-2.5 px-3">Conduit</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3 text-right">Ledger TX</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-850">
                    {filteredThreatEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-cyber-850/50 transition-colors">
                        <td className="py-2 px-3 text-cyber-400 whitespace-nowrap">{evt.timestamp}</td>
                        <td className="py-2 px-3 text-cyber-100 font-sans font-medium">{evt.event}</td>
                        <td className="py-2 px-3 text-cyan-300">{evt.attackStage}</td>
                        <td className="py-2 px-3 text-cyber-300">
                          <span className="text-red-300">{evt.sourceIp}</span> &rarr; {evt.destIp}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={evt.severity} size="xs">{evt.severity}</Badge>
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyber-800 text-cyan-300 border border-cyber-700">
                            {evt.actionTaken}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-cyber-400 font-mono text-[11px]">
                          {evt.blockchainTx}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CyberPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
