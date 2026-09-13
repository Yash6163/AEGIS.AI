'use client';

import React from 'react';
import { ShieldCheck, Cpu, Database, Server, X, CheckCircle2, ArrowRight, Code2 } from 'lucide-react';
import { CyberPanel } from '../ui/CyberPanel';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface DemoModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoModeModal: React.FC<DemoModeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cyber-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-cyber-900 border border-cyber-700/80 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-cyber-950/80 border-b border-cyber-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-500/40">
              <Cpu className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold text-cyber-100 uppercase tracking-wide">
                  AEGIS.AI Execution Architecture & Demo Mode Notice
                </h3>
                <Badge variant="mock" size="xs">
                  HIGH-FIDELITY SYNTHETIC SOC
                </Badge>
              </div>
              <p className="text-[11px] text-cyber-400 font-sans mt-0.5">
                Transparent disclosure of synthetic heuristic engine vs live production backend integration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-cyber-400 hover:text-cyber-200 hover:bg-cyber-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 font-mono text-xs">
          {/* Important Disclosure Banner */}
          <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/40 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1 font-sans text-xs">
              <span className="font-mono font-bold text-cyan-300 block">
                Deterministic Presentation Mode Active
              </span>
              <p className="text-cyber-300 leading-relaxed">
                For SIH jury evaluation and offline reliability, the platform runs on high-fidelity synthetic heuristics that accurately emulate real-world network anomalies, temporal transitions $P(S(t+1) \mid S(t))$, SHAP explainability kernels, and consensus logs without dependency on live multi-gigabyte GPU clusters.
              </p>
            </div>
          </div>

          {/* Microservice Decoupling Flow */}
          <div className="space-y-2">
            <span className="text-cyber-300 font-bold uppercase text-[11px] tracking-wider block">
              Pluggable Microservice Contracts
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 space-y-1.5">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Server className="h-4 w-4" />
                  <span className="font-bold text-[11px]">Next.js Frontend</span>
                </div>
                <p className="text-[10px] text-cyber-400 font-sans">
                  Decoupled UI consumer. Calls interface contracts in <code className="text-cyan-400">src/services/contracts/</code>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-300">
                  <Cpu className="h-4 w-4" />
                  <span className="font-bold text-[11px]">Python ML Service</span>
                </div>
                <p className="text-[10px] text-cyber-400 font-sans">
                  PyTorch / TGNN inference endpoint (<code className="text-amber-400">POST /api/v1/predict</code>). Switchable in Settings.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 space-y-1.5">
                <div className="flex items-center gap-2 text-purple-300">
                  <Database className="h-4 w-4" />
                  <span className="font-bold text-[11px]">Ledger Node RPC</span>
                </div>
                <p className="text-[10px] text-cyber-400 font-sans">
                  Hyperledger Besu / Ethereum Sepolia JSON-RPC client (<code className="text-purple-400">eth_call</code> / smart contract).
                </p>
              </div>
            </div>
          </div>

          {/* Quick Environment Variables */}
          <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 space-y-2">
            <span className="text-cyber-400 text-[10px] uppercase font-bold tracking-wider block">
              Connecting Live Endpoints via Environment Variables:
            </span>
            <div className="bg-cyber-900 p-2 rounded text-[11px] text-cyber-300 font-mono overflow-x-auto space-y-1">
              <div><span className="text-cyan-400">NEXT_PUBLIC_ENABLE_MOCK_SERVICES</span>=false</div>
              <div><span className="text-cyan-400">NEXT_PUBLIC_AI_ENGINE_URL</span>=https://ml-api.aegis.defense/v1</div>
              <div><span className="text-cyan-400">NEXT_PUBLIC_BLOCKCHAIN_RPC_URL</span>=http://localhost:8545</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-cyber-950/80 border-t border-cyber-800 flex items-center justify-between">
          <span className="text-[10px] font-mono text-cyber-500">
            COMPLIANT WITH SIH EVALUATION GUIDELINES
          </span>
          <Button variant="cyber" size="xs" onClick={onClose}>
            ACKNOWLEDGE & RETURN
          </Button>
        </div>
      </div>
    </div>
  );
};
