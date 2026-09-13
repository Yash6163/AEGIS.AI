'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export interface DemoStep {
  id: number;
  label: string;
  chapter: string;
  route: string;
  question: string;
  tag: string;
}

export const DEMO_STEPS: DemoStep[] = [
  { id: 1, label: '01 INGEST', chapter: 'DATA ENTERS', route: '/upload', question: 'What data enters the cyber universe?', tag: 'PCAP / CSV' },
  { id: 2, label: '02 ANALYZE', chapter: 'TRAFFIC FLOWS', route: '/analysis', question: 'How is traffic moving through the network?', tag: 'FLOWS & IAT' },
  { id: 3, label: '03 STATE', chapter: 'STATE FORMS', route: '/attack-path', question: 'What does the network state look like now?', tag: 'S(t) TOPOLOGY' },
  { id: 4, label: '04 MODEL', chapter: 'AI UNDERSTANDS', route: '/forecast', question: 'How does AI model state transitions?', tag: 'TGNN / LSTM' },
  { id: 5, label: '05 FORECAST', chapter: 'FUTURE EMERGES', route: '/forecast', question: 'What will happen next in future states?', tag: 'P(S_t+1 | S_t)' },
  { id: 6, label: '06 EXPLAIN', chapter: 'WHY PREDICTED', route: '/explainability', question: 'Why did AI choose this attack trajectory?', tag: 'SHAP ATTRIBUTION' },
  { id: 7, label: '07 PROOF', chapter: 'EVIDENCE SEALED', route: '/blockchain', question: 'How is prediction sealed on the ledger?', tag: 'SHA-256 MERKLE' },
  { id: 8, label: '08 INTEL', chapter: 'INTELLIGENCE SPREADS', route: '/threat-intelligence', question: 'How does threat intelligence propagate?', tag: 'STIX / TAXII' },
  { id: 9, label: '09 DECIDE', chapter: 'DEFENDER ACTS', route: '/dashboard', question: 'How does the defender turn prediction into action?', tag: 'CONTAINMENT' },
];

export const DemoFlowBanner: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  // Find current step index based on pathname
  const currentStepIndex = React.useMemo(() => {
    if (pathname === '/upload') return 0;
    if (pathname === '/analysis') return 1;
    if (pathname === '/attack-path') return 2;
    if (pathname === '/forecast') return 4;
    if (pathname === '/explainability') return 5;
    if (pathname === '/blockchain') return 6;
    if (pathname === '/threat-intelligence') return 7;
    if (pathname === '/dashboard') return 8;
    return 0;
  }, [pathname]);

  const currentStep = DEMO_STEPS[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < DEMO_STEPS.length - 1) {
      router.push(DEMO_STEPS[currentStepIndex + 1].route);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      router.push(DEMO_STEPS[currentStepIndex - 1].route);
    }
  };

  return (
    <div className="border-b border-cyber-800/60 bg-[#060a10]/80 backdrop-blur-xl sticky top-0 z-20 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono">
        {/* Left: Cyber Chapter Question */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 shrink-0 text-[10px] font-bold shadow-cyan-glow/30">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            <span>UNIVERSE CHAPTER {currentStep.id}/9</span>
          </div>

          <div className="flex items-center gap-2 truncate">
            <span className="text-cyan-300 font-bold uppercase">{currentStep.chapter}:</span>
            <span className="text-cyber-200 font-sans font-medium truncate">{currentStep.question}</span>
          </div>
        </div>

        {/* Center / Right: The 9 Step Spatial Navigator */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full no-scrollbar">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="p-1 rounded bg-cyber-950/80 hover:bg-cyber-900 border border-cyber-800 text-cyber-400 hover:text-cyan-300 disabled:opacity-30 disabled:hover:text-cyber-400 transition-colors shrink-0"
            title="Previous Chapter"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>

          <div className="flex items-center gap-1">
            {DEMO_STEPS.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;

              return (
                <Link
                  key={step.id}
                  href={step.route}
                  className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-all flex items-center gap-1 border ${
                    isActive
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-400 font-bold shadow-cyan-glow/40 ring-1 ring-cyan-400/40'
                      : isPast
                      ? 'bg-cyber-950/70 text-emerald-400/90 border-emerald-800/40 hover:border-emerald-600'
                      : 'bg-cyber-950/30 text-cyber-500 border-transparent hover:text-cyber-300'
                  }`}
                  title={`${step.label} — ${step.chapter}: ${step.question}`}
                >
                  {isPast ? (
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                  ) : (
                    <span>0{step.id}</span>
                  )}
                  <span className="hidden lg:inline">{step.chapter}</span>
                </Link>
              );
            })}
          </div>

          <button
            onClick={handleNext}
            disabled={currentStepIndex === DEMO_STEPS.length - 1}
            className="p-1 rounded bg-cyber-950/80 hover:bg-cyber-900 border border-cyber-800 text-cyber-400 hover:text-cyan-300 disabled:opacity-30 disabled:hover:text-cyber-400 transition-colors shrink-0"
            title="Next Chapter"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
