'use client';

import React from 'react';
import { CyberPanel } from '@/components/ui/CyberPanel';
import { Badge } from '@/components/ui/Badge';
import { Check, X, ShieldAlert, Award } from 'lucide-react';

export default function CompetitorsPage() {
  const comparisons = [
    {
      feature: 'Temporal Future Attack Prediction (K-Step)',
      aegis: true,
      darktrace: false,
      crowdstrike: false,
      splunk: false,
      note: 'Predicts explicit future states S(t+K) instead of reactive anomaly detection',
    },
    {
      feature: 'Discrete Network State Transition Graphs',
      aegis: true,
      darktrace: false,
      crowdstrike: false,
      splunk: false,
      note: 'Models deterministic transition probabilities across network topology',
    },
    {
      feature: 'MITRE ATT&CK Future Path Mapping',
      aegis: true,
      darktrace: true,
      crowdstrike: true,
      splunk: true,
      note: 'Aegis projects next probable tactics before execution occurs',
    },
    {
      feature: 'Tamper-Proof Blockchain Evidence Ledger',
      aegis: true,
      darktrace: false,
      crowdstrike: false,
      splunk: false,
      note: 'Decentralized SHA-256 state seal for legal and forensic compliance',
    },
    {
      feature: 'Explainable AI (SHAP / LIME Kernel Explanations)',
      aegis: true,
      darktrace: false,
      crowdstrike: false,
      splunk: false,
      note: 'Transparent mathematical feature attributions for human SOC analysts',
    },
    {
      feature: 'Collaborative Decentralized Threat Intel (STIX)',
      aegis: true,
      darktrace: false,
      crowdstrike: true,
      splunk: true,
      note: 'Zero-trust peer exchange without centralized telemetry monopoly',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-mono font-bold text-cyber-100 uppercase tracking-wide">
            Competitive Benchmark & SIH USP Matrix
          </h1>
          <p className="text-xs text-cyber-400 font-sans mt-1">
            Why Aegis AI fundamentally outperforms reactive legacy SIEM and signature-based EDR/XDR platforms
          </p>
        </div>
        <Badge variant="cyber" size="sm">
          SIH WINNING ADVANTAGE
        </Badge>
      </div>

      <CyberPanel
        title="Predictive Defence vs Legacy Industry Solutions"
        subtitle="Feature-by-feature architectural distinction"
        accent="cyan"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-cyber-800 text-cyber-400 uppercase text-[10px] bg-cyber-950/80">
                <th className="py-3 px-3">Capability / Innovation</th>
                <th className="py-3 px-3 text-cyan-300 font-bold bg-cyan-950/40">AEGIS.AI (PROPOSED)</th>
                <th className="py-3 px-3">Darktrace (Enterprise Immune)</th>
                <th className="py-3 px-3">CrowdStrike Falcon</th>
                <th className="py-3 px-3">Splunk Enterprise SIEM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-850">
              {comparisons.map((row, idx) => (
                <tr key={idx} className="hover:bg-cyber-850/40">
                  <td className="py-3 px-3 text-cyber-100 font-medium">
                    <div>{row.feature}</div>
                    <span className="text-[10px] text-cyber-500 font-sans">{row.note}</span>
                  </td>
                  <td className="py-3 px-3 bg-cyan-950/30 text-cyan-300 font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Check className="h-4 w-4" /> INCLUDED
                    </span>
                  </td>
                  <td className="py-3 px-3 text-cyber-400">
                    {row.darktrace ? (
                      <span className="flex items-center gap-1 text-cyber-300"><Check className="h-3.5 w-3.5" /> Partial</span>
                    ) : (
                      <span className="flex items-center gap-1 text-cyber-600"><X className="h-3.5 w-3.5" /> None</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-cyber-400">
                    {row.crowdstrike ? (
                      <span className="flex items-center gap-1 text-cyber-300"><Check className="h-3.5 w-3.5" /> Reactive</span>
                    ) : (
                      <span className="flex items-center gap-1 text-cyber-600"><X className="h-3.5 w-3.5" /> None</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-cyber-400">
                    {row.splunk ? (
                      <span className="flex items-center gap-1 text-cyber-300"><Check className="h-3.5 w-3.5" /> Rule-based</span>
                    ) : (
                      <span className="flex items-center gap-1 text-cyber-600"><X className="h-3.5 w-3.5" /> None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CyberPanel>

      {/* SIH Value Proposition Banner */}
      <div className="p-4 rounded-lg bg-cyan-950/40 border border-cyan-500/50 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-cyan-950 border border-cyan-500 flex items-center justify-center shrink-0 shadow-cyan-glow">
            <Award className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <span className="font-bold text-cyan-300 uppercase tracking-wide text-xs block">
              Core SIH Innovation: Autonomous Temporal Defense
            </span>
            <p className="text-[11px] text-cyber-300 font-sans mt-0.5">
              By shifting from reactive post-incident detection to mathematical K-step forward simulation P(S(t+1)|S(t)), defenders achieve proactive containment before credential exfiltration occurs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a href="/forecast" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-cyber-950 transition-colors shadow-cyan-glow">
            <span>VIEW K-STEP FORECAST</span>
          </a>
          <a href="/dashboard" className="px-3 py-1.5 rounded text-xs font-mono border border-cyber-700 hover:bg-cyber-900 text-cyber-200 transition-colors">
            SOC DASHBOARD
          </a>
        </div>
      </div>
    </div>
  );
}
