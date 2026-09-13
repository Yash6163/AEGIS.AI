'use client';

import React, { useState } from 'react';
import { CyberPanel } from '@/components/ui/CyberPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCyberToast } from '@/components/ui/CyberToast';
import {
  Sliders,
  Database,
  Cpu,
  Save,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Server,
  Zap,
  Radio,
} from 'lucide-react';

export default function SettingsPage() {
  const [dataMode, setDataMode] = useState<'mock' | 'production'>('mock');
  const [rpcUrl, setRpcUrl] = useState('http://localhost:8545');
  const [mlEndpoint, setMlEndpoint] = useState('http://localhost:8000/api/v1/predict');
  const [taxiiUrl, setTaxiiUrl] = useState('https://threat-intel.aegis-cyber.local/taxii2/');
  const [testingMl, setTestingMl] = useState(false);
  const [testingRpc, setTestingRpc] = useState(false);
  const { showToast } = useCyberToast();

  const handleSave = () => {
    showToast(
      'Engine Settings Synchronized',
      `Platform configured in ${dataMode.toUpperCase()} mode. Endpoint references updated in memory.`,
      'success'
    );
  };

  const handleTestMl = () => {
    setTestingMl(true);
    setTimeout(() => {
      setTestingMl(false);
      showToast(
        'PyTorch Endpoint Responded (Simulation)',
        `Health check passed on ${mlEndpoint} (Latency: 28ms, Model: NeuroCyber-XGB-v3.4.1)`,
        'info'
      );
    }, 1000);
  };

  const handleTestRpc = () => {
    setTestingRpc(true);
    setTimeout(() => {
      setTestingRpc(false);
      showToast(
        'Besu Ledger Node Synced (Simulation)',
        `JSON-RPC response: eth_blockNumber #4892184, 5/5 IBFT validators responsive on ${rpcUrl}`,
        'info'
      );
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold text-cyber-100 uppercase tracking-wide">
              Platform Engine & Service Configuration
            </h1>
            <Badge variant="mock" size="xs">
              MOCK CONTAINER ACTIVE
            </Badge>
          </div>
          <p className="text-xs text-cyber-400 font-sans mt-1">
            Configure telemetry provider mode, Python ML inference microservices, and decentralized ledger RPC connections
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave} icon={<Save className="h-3.5 w-3.5" />}>
          SAVE CONFIGURATION
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CyberPanel
          title="Telemetry & Heuristic Mode"
          subtitle="Toggle between synthetic heuristic mock and live production microservices"
          accent="cyan"
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between p-3 rounded bg-cyber-950 border border-cyber-800">
              <div>
                <span className="text-cyber-100 font-bold block">Active Telemetry Provider</span>
                <span className="text-cyber-400 text-[11px] font-sans">
                  {dataMode === 'mock'
                    ? 'Synthetic SOC heuristic dataset (Offline SIH evaluation resilient)'
                    : 'Targeting external FastAPI PyTorch engine & Besu RPC'}
                </span>
              </div>
              <Badge variant={dataMode === 'mock' ? 'mock' : 'live'} size="sm">
                {dataMode.toUpperCase()}
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-cyber-400 text-[11px] uppercase block">Provider Selector</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDataMode('mock');
                    showToast('Switched to Mock Demo Mode', 'Using deterministic high-fidelity synthetic SOC heuristics.', 'info');
                  }}
                  className={`flex-1 py-2 px-3 rounded border text-xs font-mono transition-colors ${
                    dataMode === 'mock'
                      ? 'bg-purple-950 border-purple-500 text-purple-300 font-bold shadow-cyan-glow/10'
                      : 'bg-cyber-900 border-cyber-700 text-cyber-400 hover:text-cyber-200'
                  }`}
                >
                  MOCK HEURISTIC (DEMO)
                </button>
                <button
                  onClick={() => {
                    setDataMode('production');
                    showToast('Production Backend Mode Enabled', 'Directing requests to microservice endpoints specified below.', 'warning');
                  }}
                  className={`flex-1 py-2 px-3 rounded border text-xs font-mono transition-colors ${
                    dataMode === 'production'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-cyber-900 border-cyber-700 text-cyber-400 hover:text-cyber-200'
                  }`}
                >
                  LIVE API BACKEND
                </button>
              </div>
            </div>

            {/* Architecture Explainer */}
            <div className="p-3 rounded bg-cyber-950 border border-cyber-800 space-y-1 text-[11px] font-sans">
              <span className="text-cyan-400 font-mono font-semibold block text-xs">
                Zero UI Coupling Guarantee:
              </span>
              <p className="text-cyber-300 leading-relaxed">
                All components invoke abstraction contracts in <code className="text-cyan-300 font-mono">src/services/contracts/</code>. To switch to live FastAPI in production, simply swap the service factory in <code className="text-cyan-300 font-mono">src/services/index.ts</code>.
              </p>
            </div>
          </div>
        </CyberPanel>

        <CyberPanel
          title="Backend Integration Endpoints"
          subtitle="Ready for plugging in Python FastAPI and Blockchain nodes"
          accent="cyan"
        >
          <div className="space-y-4 font-mono text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-cyber-400 text-[10px] uppercase">
                  PyTorch / TGNN Inference REST Endpoint
                </label>
                <button
                  onClick={handleTestMl}
                  disabled={testingMl}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 underline disabled:opacity-50"
                >
                  {testingMl ? 'PINGING...' : 'TEST PING'}
                </button>
              </div>
              <input
                type="text"
                value={mlEndpoint}
                onChange={(e) => setMlEndpoint(e.target.value)}
                className="w-full bg-cyber-950 border border-cyber-700 rounded px-3 py-1.5 text-cyan-300 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-cyber-400 text-[10px] uppercase">
                  Hyperledger Besu / Ethereum RPC Node
                </label>
                <button
                  onClick={handleTestRpc}
                  disabled={testingRpc}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 underline disabled:opacity-50"
                >
                  {testingRpc ? 'PINGING...' : 'TEST PING'}
                </button>
              </div>
              <input
                type="text"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                className="w-full bg-cyber-950 border border-cyber-700 rounded px-3 py-1.5 text-cyber-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-cyber-400 text-[10px] uppercase block mb-1">
                STIX 2.1 / TAXII 2.1 Syndicate Server
              </label>
              <input
                type="text"
                value={taxiiUrl}
                onChange={(e) => setTaxiiUrl(e.target.value)}
                className="w-full bg-cyber-950 border border-cyber-700 rounded px-3 py-1.5 text-cyber-300 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="p-2.5 rounded bg-cyber-950/60 border border-cyber-800 text-[11px] font-sans text-cyber-400 flex items-center justify-between">
              <span>Environment configuration template available in <code className="text-cyan-300 font-mono">.env.example</code></span>
              <Badge variant="verified" size="xs">READY</Badge>
            </div>
          </div>
        </CyberPanel>
      </div>
    </div>
  );
}
