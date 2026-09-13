'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { services } from '@/services';
import {
  ExplainabilityReport,
  FeatureContribution,
} from '@/types/explainability';
import { mockExplainabilityReport } from '@/services/mock/mockData';
import { CyberPanel } from '@/components/ui/CyberPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function ExplainabilityPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<ExplainabilityReport>(mockExplainabilityReport);
  const [filterDirection, setFilterDirection] = useState<'all' | 'positive' | 'negative'>('all');
  const [selectedFeature, setSelectedFeature] = useState<FeatureContribution>(
    mockExplainabilityReport.features[0]
  );
  const [showAttention, setShowAttention] = useState<boolean>(false);

  const refreshReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await services.getExplainabilityService().getReport();
      if (res.success) {
        setReport(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to acquire explainability report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshReport();
  }, []);

  if (error) {
    return (
      <div className="py-16">
        <ErrorState
          title="XAI INFERENCE ENGINE DISCONNECT"
          message={error}
          onRetry={refreshReport}
        />
      </div>
    );
  }

  const filteredFeatures = report.features.filter((f) => {
    if (filterDirection === 'positive') return f.direction === 'positive';
    if (filterDirection === 'negative') return f.direction === 'negative';
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative z-10">
      {/* 1. Evaluator Purpose Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 shadow-cyan-glow/30">
              CHAPTER 06 &bull; EXPLAIN
            </span>
            <h1 className="text-xl font-mono font-bold text-cyber-100 uppercase tracking-wide">
              Why Did the AI Choose This Path?
            </h1>
          </div>
          <p className="text-sm text-cyber-300 font-sans mt-1">
            <strong className="text-cyan-300 font-mono">Core Theme:</strong> &quot;Why did the AI make this prediction?&quot; &bull;{' '}
            <span className="text-cyber-400">
              Connecting observed telemetry signals directly to neural state transition decisions.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/blockchain">
            <Button variant="primary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              NEXT: 07 BLOCKCHAIN PROOF
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Visual Reasoning Pipeline Flow: Observed Signal -> Feature Contribution -> Model Prediction */}
      <CyberPanel title="Visual Reasoning Pipeline: Signals → Attribution → Predicted State" subtitle="Mathematical attribution connecting observed anomaly spikes to future transitions">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center py-2 text-center font-mono text-xs">
          <div className="p-3 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyber-500 block uppercase">1. Observed Signals</span>
            <span className="font-bold text-cyber-200 text-xs block mt-0.5">SYN & Port 445</span>
            <span className="text-[9px] text-cyber-400 font-sans">480 pps, 7.82 b/B</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-3 rounded bg-cyan-950/60 border border-cyan-400 text-cyan-300 shadow-cyan-glow/20">
            <span className="text-[9px] text-cyan-400 block uppercase">2. SHAP Attribution</span>
            <span className="font-bold text-xs block mt-0.5">Feature Weights</span>
            <span className="text-[9px] text-cyber-300 font-sans">+94% SYN, +88% SMB</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-3 rounded bg-cyber-950/80 border border-red-500/50 shadow-red-glow/10">
            <span className="text-[9px] text-red-400 block uppercase">3. Target State</span>
            <span className="font-bold text-red-300 text-xs block mt-0.5">Lateral Move (86.4%)</span>
            <span className="text-[9px] text-cyber-300 font-sans">Imminent Pivot</span>
          </div>
        </div>

        {/* 1-Sentence Concise Plain-Language SOC Analyst Explanation */}
        <div className="mt-3 p-3 rounded-lg bg-cyber-950/80 border border-cyber-750 text-xs flex items-start gap-2.5">
          <div className="h-7 w-7 rounded bg-cyan-950 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <Brain className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <span className="font-mono text-cyan-400 font-bold text-[11px] block uppercase">
              Analyst Executive Synthesis:
            </span>
            <p className="text-cyber-100 font-sans text-xs mt-0.5 leading-relaxed">
              &ldquo;High SYN packet rate (480 pps) combined with abnormal port 445 activity and elevated Shannon entropy significantly increased the probability of imminent lateral movement towards the Domain Controller.&rdquo;
            </p>
          </div>
        </div>
      </CyberPanel>

      {/* 3. Primary Visual: Ranked Horizontal Feature Contribution Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <CyberPanel
            title="Feature Contributions (SHAP Attribution)"
            subtitle="Ranked impact of observed metrics on lateral movement prediction (+86.4%)"
            accent="cyan"
            actions={
              <div className="flex items-center gap-1 font-mono text-xs">
                <button
                  onClick={() => setFilterDirection('all')}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    filterDirection === 'all'
                      ? 'bg-cyber-800 text-cyan-300 font-bold border border-cyber-700'
                      : 'text-cyber-400 hover:text-cyber-200'
                  }`}
                >
                  All ({report.features.length})
                </button>
                <button
                  onClick={() => setFilterDirection('positive')}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    filterDirection === 'positive'
                      ? 'bg-red-950 text-red-300 font-bold border border-red-800'
                      : 'text-cyber-400 hover:text-cyber-200'
                  }`}
                >
                  Drivers (+{report.features.filter((f) => f.direction === 'positive').length})
                </button>
                <button
                  onClick={() => setFilterDirection('negative')}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    filterDirection === 'negative'
                      ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800'
                      : 'text-cyber-400 hover:text-cyber-200'
                  }`}
                >
                  Dampeners (-{report.features.filter((f) => f.direction === 'negative').length})
                </button>
              </div>
            }
          >
            <div className="space-y-3 font-mono text-xs">
              {filteredFeatures.map((feat) => {
                const isSelected = selectedFeature.id === feat.id;
                const isPositive = feat.direction === 'positive';
                const absScore = Math.abs(feat.contributionScore);

                return (
                  <div
                    key={feat.id}
                    onClick={() => setSelectedFeature(feat)}
                    className={`cursor-pointer p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-cyber-850 border-cyan-400 shadow-cyan-glow/20'
                        : 'bg-cyber-950/80 border-cyber-800 hover:border-cyber-700 hover:bg-cyber-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isPositive ? (
                          <ArrowUpRight className="h-4 w-4 text-red-400 shrink-0" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-cyan-400 shrink-0" />
                        )}
                        <span className="font-bold text-cyber-100 text-xs">{feat.featureName}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyber-900 text-cyber-400 border border-cyber-800 uppercase">
                          {feat.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-cyber-400 text-xs">
                          Observed: <span className="text-cyber-100 font-bold">{feat.observedValue}</span>
                        </span>
                        <span
                          className={`font-bold text-sm ${
                            isPositive ? 'text-red-400' : 'text-cyan-300'
                          }`}
                        >
                          {isPositive ? '+' : ''}{feat.contributionScore.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="relative w-full h-2.5 bg-cyber-900 rounded-full overflow-hidden border border-cyber-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${absScore}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                          isPositive
                            ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                            : 'bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.5)]'
                        }`}
                      />
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-cyber-500">
                      <span className="truncate pr-2 font-sans">{feat.description}</span>
                      <span className="shrink-0">SHAP: {feat.shapValue > 0 ? '+' : ''}{feat.shapValue.toFixed(3)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CyberPanel>
        </div>

        {/* Selected Feature Detail */}
        <div className="lg:col-span-4 space-y-4">
          <CyberPanel
            title={`Feature Detail // ${selectedFeature.featureName}`}
            subtitle={`Attribution Value: ${selectedFeature.shapValue > 0 ? '+' : ''}${selectedFeature.shapValue.toFixed(3)}`}
            accent={selectedFeature.direction === 'positive' ? 'red' : 'cyan'}
          >
            <div className="space-y-3 font-mono text-xs">
              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                <span className="text-[10px] text-cyber-500 uppercase block">Model Interpretation</span>
                <p className="text-cyber-200 text-xs font-sans mt-1 leading-relaxed">
                  {selectedFeature.rationale}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-cyber-950/80 border border-cyber-800">
                  <span className="text-[10px] text-cyber-500 uppercase block">Observed Value</span>
                  <span className="text-cyan-300 font-bold block mt-0.5">{selectedFeature.observedValue}</span>
                </div>
                <div className="p-2 rounded bg-cyber-950/80 border border-cyber-800">
                  <span className="text-[10px] text-cyber-500 uppercase block">Benign Baseline</span>
                  <span className="text-cyber-400 font-bold block mt-0.5">{selectedFeature.baselineValue}</span>
                </div>
              </div>

              <div className="p-2 rounded bg-cyber-950/80 border border-cyber-800 flex justify-between items-center text-xs">
                <span className="text-cyber-400">Impact on Threat:</span>
                <span className={`font-bold ${selectedFeature.direction === 'positive' ? 'text-red-400' : 'text-cyan-300'}`}>
                  {selectedFeature.direction === 'positive' ? '▲ Escalates Risk' : '▼ Dampens Risk'}
                </span>
              </div>

              <div className="pt-2 border-t border-cyber-800 flex flex-col gap-2">
                <Link href="/blockchain">
                  <Button variant="cyber" size="sm" className="w-full" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                    TRAVEL TO 07 BLOCKCHAIN PROOF
                  </Button>
                </Link>
                <Link href="/attack-path">
                  <Button variant="outline" size="sm" className="w-full">
                    VIEW ATTACK TOPOLOGY GRAPH
                  </Button>
                </Link>
              </div>
            </div>
          </CyberPanel>

          {/* Attention Weights Drawer */}
          <div className="rounded-xl border border-cyber-800/80 bg-cyber-950/60 backdrop-blur-md p-3 font-mono text-xs">
            <button
              onClick={() => setShowAttention(!showAttention)}
              className="w-full flex items-center justify-between text-cyber-300 hover:text-cyan-300"
            >
              <span className="font-bold text-[11px]">CROSS-ATTENTION HEADS (4 HEADS)</span>
              {showAttention ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showAttention && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 pt-2.5 mt-2 border-t border-cyber-800 text-[11px]"
              >
                {report.attentionWeights.slice(0, 2).map((att) => (
                  <div key={att.headId} className="p-2 rounded bg-cyber-950 border border-cyber-850">
                    <div className="flex justify-between text-[10px] text-cyber-400">
                      <span>Head #{att.headId} &bull; {att.temporalWindow}</span>
                      <span className="text-cyan-300 font-bold">Weight: {att.weight.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-cyber-400 font-sans mt-0.5">{att.interpretation}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
