'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  ArrowRight,
  Play,
  Activity,
  Layers,
  Target,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Brain,
  Cpu,
  Sparkles,
} from 'lucide-react';
import { services } from '@/services';
import {
  AttackPredictionSummary,
  FutureStateStep,
  ModelMetadata,
  PredictionConfig,
  TrajectoryStageNode,
} from '@/types/prediction';
import { CurrentNetworkState } from '@/types/network';
import { CyberPanel } from '@/components/ui/CyberPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useCyberToast } from '@/components/ui/CyberToast';

import {
  mockPredictionSummary,
  mockNetworkState,
  mockModelMetadata,
  mockAttackTrajectory,
  mockFutureSteps,
} from '@/services/mock/mockData';

export default function ForecastPage() {
  const [loading, setLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prediction, setPrediction] = useState<AttackPredictionSummary>(mockPredictionSummary);
  const [currentState, setCurrentState] = useState<CurrentNetworkState>(mockNetworkState);
  const [futureSteps, setFutureSteps] = useState<FutureStateStep[]>(mockFutureSteps.slice(0, 6));
  const [trajectory, setTrajectory] = useState<TrajectoryStageNode[]>(mockAttackTrajectory);
  const [modelMeta, setModelMeta] = useState<ModelMetadata>(mockModelMetadata);

  const [kSteps, setKSteps] = useState<number>(5);
  const [stepDuration, setStepDuration] = useState<number>(5);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(85);
  const [selectedModel, setSelectedModel] = useState<
    'TGNN + Temporal Attention' | 'Dual-LSTM + Markov' | 'Cyber-Mamba StateSpace'
  >('TGNN + Temporal Attention');

  const [inspectedStepIndex, setInspectedStepIndex] = useState<number>(1);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showModelDetails, setShowModelDetails] = useState<boolean>(false);
  const { showToast } = useCyberToast();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [predRes, netRes, modelRes, trajRes] = await Promise.all([
        services.getPredictionService().getLatestPrediction(),
        services.getNetworkService().getCurrentState(),
        services.getPredictionService().getModelMetadata(),
        services.getPredictionService().getAttackTrajectory(),
      ]);

      if (!predRes.success || !netRes.success) {
        throw new Error('Failed to acquire prediction telemetry from service registry');
      }

      setPrediction(predRes.data);
      setCurrentState(netRes.data);
      setModelMeta(modelRes.data);
      setTrajectory(trajRes.data);
      setFutureSteps(predRes.data.futureStates.slice(0, kSteps + 1));
    } catch (err: any) {
      setError(err?.message || 'Inference engine connection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const config: PredictionConfig = {
        kSteps,
        stepDurationMinutes: stepDuration,
        modelVersion: modelMeta?.modelVersion || 'TGNN-v3.4.1',
        confidenceThreshold,
        modelType: selectedModel,
      };

      const res = await services.getPredictionService().simulateKSteps(config);
      if (res.success) {
        setFutureSteps(res.data);
        if (inspectedStepIndex > res.data.length - 1) {
          setInspectedStepIndex(res.data.length - 1);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setIsSimulating(false);
      }, 500);
    }
  };

  if (loading) {
    return (
      <div className="py-16">
        <LoadingState
          label="INITIALIZING TEMPORAL PREDICTION KERNEL"
          subtext="Computing graph embeddings, Markov transition probabilities P(S(t+1) | S(t)), and forward state horizons..."
        />
      </div>
    );
  }

  if (error || !prediction || !currentState || !modelMeta) {
    return (
      <div className="py-16">
        <ErrorState
          title="PREDICTION SERVICE DISCONNECT"
          message={error || 'Unable to retrieve state forecast'}
          onRetry={loadData}
        />
      </div>
    );
  }

  const inspectedStep = futureSteps[inspectedStepIndex] || futureSteps[0];
  const totalHorizonMinutes = kSteps * stepDuration;

  // SVG Coordinates for Chart
  const chartWidth = 700;
  const chartHeight = 150;
  const paddingX = 40;
  const paddingY = 20;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  const points = futureSteps.map((step, idx) => {
    const x =
      futureSteps.length > 1
        ? paddingX + (idx / (futureSteps.length - 1)) * usableWidth
        : paddingX;
    const y = chartHeight - paddingY - (step.riskScore / 100) * usableHeight;
    return { x, y, step };
  });

  const pathD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cpX1 = prev.x + (pt.x - prev.x) / 2;
    const cpX2 = prev.x + (pt.x - prev.x) / 2;
    return `${acc} C ${cpX1} ${prev.y}, ${cpX2} ${pt.y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative z-10">
      {/* 1. Evaluator Purpose Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 shadow-cyan-glow/30">
              CHAPTER 04 & 05 &bull; HERO FEATURE
            </span>
            <h1 className="text-xl font-mono font-bold text-cyber-100 uppercase tracking-wide">
              The System Looks into the Future
            </h1>
          </div>
          <p className="text-sm text-cyber-300 font-sans mt-1">
            <strong className="text-cyan-300 font-mono">Core Theme:</strong> &quot;What will happen next?&quot; &bull;{' '}
            <span className="text-cyber-400">
              Forecasting future attack stages up to 30 minutes in advance using temporal graph neural networks.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/explainability">
            <Button variant="primary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              NEXT: 06 EXPLAINABILITY
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Step 4: AI World Model Spatial Diagram */}
      <CyberPanel
        title="Chapter 04: AI World Model Pipeline &bull; P(S(t+1) | S(t))"
        subtitle="AI learns how the network changes over time to estimate future attack progression"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center py-2 text-center font-mono text-xs">
          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyber-500 block uppercase">1. Network State</span>
            <span className="font-bold text-cyber-200 text-xs block mt-0.5">S(t) Snapshot</span>
            <span className="text-[9px] text-cyber-400 font-sans">Nodes & Conduits</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyan-400 block uppercase">2. Representation</span>
            <span className="font-bold text-cyan-200 text-xs block mt-0.5">Graph Embeddings</span>
            <span className="text-[9px] text-cyber-400 font-sans">Bipartite Tensors</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyan-950/60 border border-cyan-400 text-cyan-300 shadow-cyan-glow/20">
            <span className="text-[9px] text-cyan-400 block uppercase">3. Forward Transition</span>
            <span className="font-bold text-xs block mt-0.5">TGNN State Space</span>
            <span className="text-[9px] text-cyber-300 font-sans">P(S_t+1 | S_t)</span>
          </div>
        </div>

        <div className="mt-2.5 p-2 rounded bg-cyber-950/80 border border-cyber-800 text-[11px] font-sans text-cyber-300 flex items-center justify-between">
          <span>
            💡 <strong className="text-cyan-300 font-mono">World Model Core:</strong> The model learns how enterprise network states evolve over micro-windows so it can forecast multi-stage campaigns before lateral movement occurs.
          </span>
          <button
            onClick={() => setShowModelDetails(!showModelDetails)}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 ml-2 shrink-0"
          >
            {showModelDetails ? 'Hide ML Specs' : 'View ML Specs'}
          </button>
        </div>

        {showModelDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 mt-3 border-t border-cyber-800/80 text-xs font-mono"
          >
            <div className="p-2 rounded bg-cyber-950/80 border border-cyber-850">
              <span className="text-cyber-500 text-[10px] block uppercase">Model Backbone:</span>
              <span className="text-cyber-100 font-bold">{modelMeta.modelType}</span>
            </div>
            <div className="p-2 rounded bg-cyber-950/80 border border-cyber-850">
              <span className="text-cyber-500 text-[10px] block uppercase">Training Corpus:</span>
              <span className="text-cyber-200">CSE-CIC-IDS2018 + DARPA TC</span>
            </div>
            <div className="p-2 rounded bg-cyber-950/80 border border-cyber-850">
              <span className="text-cyber-500 text-[10px] block uppercase">Inference Speed:</span>
              <span className="text-emerald-400 font-bold">{modelMeta.inferenceLatencyMs} ms</span>
            </div>
          </motion.div>
        )}
      </CyberPanel>

      {/* 3. HERO METRICS BAR: 3 Prominent Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        <div className="p-4 rounded-xl bg-cyber-950/80 border border-red-500/50 shadow-red-glow/20 backdrop-blur-md">
          <span className="text-xs text-cyber-400 uppercase tracking-wide block">Infiltration Probability</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-red-400">{prediction.infiltrationProbability}%</span>
            <span className="text-xs text-red-300 font-sans">Imminent lateral access</span>
          </div>
          <ProgressBar value={prediction.infiltrationProbability} variant="red" size="xs" className="mt-2" />
        </div>

        <div className="p-4 rounded-xl bg-cyber-950/80 border border-amber-500/50 shadow-amber-glow/20 backdrop-blur-md">
          <span className="text-xs text-cyber-400 uppercase tracking-wide block">Time To Critical Stage</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-amber-300">14.5 min</span>
            <span className="text-xs text-amber-200 font-sans">Domain Controller impact</span>
          </div>
          <div className="text-[10px] text-cyber-500 mt-2">Next window inflection: +{stepDuration}m</div>
        </div>

        <div className="p-4 rounded-xl bg-cyber-950/80 border border-cyan-500/50 shadow-cyan-glow/20 backdrop-blur-md">
          <span className="text-xs text-cyber-400 uppercase tracking-wide block">Model Confidence</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-cyan-300">{prediction.confidenceScore}%</span>
            <span className="text-xs text-emerald-400 font-sans">Calibrated softmax</span>
          </div>
          <ProgressBar value={prediction.confidenceScore} variant="cyan" size="xs" className="mt-2" />
        </div>
      </div>

      {/* 4. HERO VISUAL: Forward Markov State Simulation Timeline S(t) -> S(t+K) */}
      <CyberPanel
        title="Chapter 05: Future Attack Forecast &bull; S(t) → S(t+1) → S(t+2) → S(t+K)"
        subtitle="Progressive simulation revealing predicted future network states deeper in the cyber universe"
        accent="cyan"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1 text-xs font-mono text-cyber-400 hover:text-cyan-300"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>TUNING</span>
            </button>
            <Button
              variant="primary"
              size="xs"
              onClick={handleRunSimulation}
              isLoading={isSimulating}
              icon={<Play className="h-3 w-3" />}
            >
              SIMULATE FORWARD
            </Button>
          </div>
        }
      >
        {/* Tuning Drawer */}
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 mb-3 border-b border-cyber-800 text-xs font-mono"
          >
            <div className="p-2.5 rounded bg-cyber-900/80 border border-cyber-750">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-cyber-400">Horizon Steps (K):</span>
                <span className="text-cyan-300 font-bold">K = {kSteps} (+{kSteps * stepDuration}m)</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                value={kSteps}
                onChange={(e) => setKSteps(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="p-2.5 rounded bg-cyber-900/80 border border-cyber-750">
              <span className="text-cyber-400 block text-[11px] mb-1">Interval (Δt):</span>
              <div className="grid grid-cols-3 gap-1">
                {[2, 5, 10].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setStepDuration(mins)}
                    className={`py-1 rounded text-center border text-[10px] ${
                      stepDuration === mins
                        ? 'bg-amber-950 border-amber-500 text-amber-300 font-bold'
                        : 'bg-cyber-950 border-cyber-800 text-cyber-400'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded bg-cyber-900/80 border border-cyber-750">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-cyber-400">Confidence Floor:</span>
                <span className="text-emerald-400 font-bold">{confidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min={60}
                max={95}
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
          </motion.div>
        )}

        {/* Sequential State Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono">
          {futureSteps.map((st, idx) => {
            const isSelected = inspectedStepIndex === idx;
            const isRoot = idx === 0;

            return (
              <motion.div
                key={st.step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
                onClick={() => setInspectedStepIndex(idx)}
                className={`cursor-pointer rounded-lg p-3 border select-none transition-all ${
                  isSelected
                    ? 'bg-cyan-950/70 border-cyan-400 shadow-cyan-glow/40 ring-1 ring-cyan-400'
                    : 'bg-cyber-950/80 border-cyber-800 hover:border-cyber-700 hover:bg-cyber-900/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className={`font-bold ${isRoot ? 'text-emerald-400' : 'text-cyan-300'}`}>
                    {st.stepLabel}
                  </span>
                  <span className="text-[10px] text-cyber-400">+{st.relativeTimeMinutes}m</span>
                </div>

                <div className="mb-2">
                  <span className="text-[9px] text-cyber-500 uppercase block">Predicted Stage</span>
                  <span className="font-bold text-xs text-cyber-100 truncate block">
                    {st.predictedStage}
                  </span>
                </div>

                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-cyber-400">Risk Score</span>
                    <span
                      className={`font-bold ${
                        st.riskScore > 85
                          ? 'text-red-400'
                          : st.riskScore > 70
                          ? 'text-amber-400'
                          : 'text-cyan-300'
                      }`}
                    >
                      {st.riskScore}
                    </span>
                  </div>
                  <ProgressBar
                    value={st.riskScore}
                    variant={st.riskScore > 85 ? 'red' : st.riskScore > 70 ? 'amber' : 'cyan'}
                    size="xs"
                  />
                </div>

                <div className="flex justify-between text-[10px] text-cyber-400 pt-1 border-t border-cyber-850">
                  <span>P(Infil): <strong className="text-red-300">{st.infiltrationProbability}%</strong></span>
                  <span>Conf: <strong className="text-emerald-300">{st.confidenceScore}%</strong></span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Selected State Tactical Inspection Box */}
        {inspectedStep && (
          <div className="mt-4 p-3.5 rounded-lg bg-cyber-950/90 border border-cyan-500/40 text-xs font-mono backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyber-800 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-cyan-300 font-bold text-sm">
                  Inspection // {inspectedStep.stepLabel} &bull; {inspectedStep.predictedStage}
                </span>
                <Badge variant={inspectedStep.severity} size="xs">
                  HORIZON: +{inspectedStep.relativeTimeMinutes}m
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-cyber-400">
                  Transition Probability: <strong className="text-cyan-300">{(inspectedStep.transitionProbability * 100).toFixed(0)}%</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span className="text-cyber-500 text-[10px] uppercase block">Target Infrastructure</span>
                <span className="text-cyber-100 font-semibold block mt-0.5">{inspectedStep.vulnerableAsset}</span>
              </div>
              <div>
                <span className="text-cyber-500 text-[10px] uppercase block">Contributing Signals</span>
                <div className="flex gap-1 flex-wrap mt-0.5">
                  {inspectedStep.importantFeatures.slice(0, 2).map((feat, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-cyber-900 text-cyber-300 border border-cyber-800 text-[10px]">
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-cyber-500 text-[10px] uppercase block">Pre-emptive Recommendation</span>
                <span className="text-amber-300 font-semibold block mt-0.5 truncate">{inspectedStep.recommendedAction}</span>
              </div>
            </div>
          </div>
        )}
      </CyberPanel>

      {/* 5. Attack Progression Chart & Mitre Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <CyberPanel
            title="Attack Progression Risk Curve"
            subtitle="Risk score trajectory across future simulated windows"
            accent="red"
          >
            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-40 select-none">
                <defs>
                  <linearGradient id="forecastRiskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0.25, 0.5, 0.75, 1.0].map((r) => {
                  const y = chartHeight - paddingY - r * usableHeight;
                  return (
                    <line
                      key={r}
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      stroke="#1E3050"
                      strokeDasharray="2 2"
                    />
                  );
                })}

                <line
                  x1={paddingX}
                  y1={chartHeight - paddingY - 0.8 * usableHeight}
                  x2={chartWidth - paddingX}
                  y2={chartHeight - paddingY - 0.8 * usableHeight}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />

                <path d={areaD} fill="url(#forecastRiskGrad)" />
                <path d={pathD} fill="none" stroke="#00F0FF" strokeWidth="2.5" />

                {points.map((pt, i) => (
                  <g key={i} className="cursor-pointer" onClick={() => setInspectedStepIndex(i)}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={inspectedStepIndex === i ? 6 : 4}
                      fill={pt.step.riskScore > 80 ? '#EF4444' : '#00F0FF'}
                      stroke="#0B111D"
                      strokeWidth="2"
                    />
                    <text
                      x={pt.x}
                      y={chartHeight - 4}
                      fill="#93B3E6"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {pt.step.stepLabel}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-cyber-500 pt-1 border-t border-cyber-800">
              <span>X-Axis: Simulated Steps &bull; Y-Axis: Risk Score (0-100)</span>
              <span className="text-red-400 font-semibold">Critical Breach Point: S(t+2)</span>
            </div>
          </CyberPanel>
        </div>

        <div className="lg:col-span-5">
          <CyberPanel
            title="Predicted Attack Trajectory"
            subtitle="MITRE ATT&CK kill-chain progression path"
            accent="red"
          >
            <div className="space-y-2 font-mono text-xs">
              {trajectory.map((node, idx) => {
                const isActive = node.status === 'active';
                const isPredicted = node.status === 'predicted';
                const isPassed = node.status === 'passed';

                return (
                  <div
                    key={node.phase}
                    className={`p-2.5 rounded border transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-red-950/40 border-red-500 shadow-red-glow/20'
                        : isPredicted
                        ? 'bg-amber-950/30 border-amber-500/60'
                        : isPassed
                        ? 'bg-cyber-950/80 border-cyber-800 opacity-70'
                        : 'bg-cyber-950/40 border-cyber-900 opacity-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-cyber-500">#{idx + 1}</span>
                        <span className="font-bold text-cyber-100 text-xs">{node.phase}</span>
                      </div>
                      <span className="text-[10px] text-cyber-400 font-sans block">{node.technique}</span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs font-bold block ${
                          isActive ? 'text-red-400' : isPredicted ? 'text-amber-400' : 'text-cyber-400'
                        }`}
                      >
                        {(node.probability * 100).toFixed(0)}%
                      </span>
                      <Badge
                        variant={isActive ? 'critical' : isPredicted ? 'high' : isPassed ? 'low' : 'neutral'}
                        size="xs"
                      >
                        {node.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CyberPanel>
        </div>
      </div>
    </div>
  );
}
