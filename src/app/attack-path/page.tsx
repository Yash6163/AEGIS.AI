'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  GitCommit,
  Lock,
  Crosshair,
  ArrowRight,
  Filter,
  CheckCircle2,
  Activity,
  Server,
  Network,
  ShieldAlert,
} from 'lucide-react';
import { services } from '@/services';
import {
  AttackPathDetails,
  NetworkDeviceNode,
  CommunicationLink,
  MitreStageNode,
} from '@/types/mitre';
import { mockAttackPathDetails } from '@/services/mock/mockData';
import { CyberPanel } from '@/components/ui/CyberPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useCyberToast } from '@/components/ui/CyberToast';

export default function AttackPathPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attackPath, setAttackPath] = useState<AttackPathDetails>(mockAttackPathDetails);
  const [selectedDevice, setSelectedDevice] = useState<NetworkDeviceNode | null>(
    mockAttackPathDetails.devices[1]
  );
  const [selectedLink, setSelectedLink] = useState<CommunicationLink | null>(null);
  const [selectedStage, setSelectedStage] = useState<MitreStageNode | null>(
    mockAttackPathDetails.stages[1]
  );
  const [filterSuspiciousOnly, setFilterSuspiciousOnly] = useState(false);
  const { showToast } = useCyberToast();

  const refreshAttackPath = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await services.getPredictionService().getAttackPathDetails();
      if (res.success) {
        setAttackPath(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to query attack path from service layer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAttackPath();
  }, []);

  if (error) {
    return (
      <div className="py-16">
        <ErrorState
          title="ATTACK PATH TELEMETRY FAILURE"
          message={error}
          onRetry={refreshAttackPath}
        />
      </div>
    );
  }

  const { currentAttackerPosition, stages, devices, links, recommendations } = attackPath;

  const filteredLinks = filterSuspiciousOnly
    ? links.filter((l) => l.isSuspicious)
    : links;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative z-10">
      {/* 1. Evaluator Purpose Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 shadow-cyan-glow/30">
              CHAPTER 03 &bull; STATE
            </span>
            <h1 className="text-xl font-mono font-bold text-cyber-100 uppercase tracking-wide">
              The System Creates a Network Snapshot
            </h1>
          </div>
          <p className="text-sm text-cyber-300 font-sans mt-1">
            <strong className="text-cyan-300 font-mono">Core Theme:</strong> &quot;What does the network look like right now?&quot; &bull;{' '}
            <span className="text-cyber-400">
              A spatial 3D topological snapshot representing devices as nodes and communications as dynamic conduits.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/forecast">
            <Button variant="primary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              NEXT: 04 AI WORLD MODEL
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Compact Current-State Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800">
          <span className="text-[10px] text-cyber-500 uppercase block">Network Health</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-bold text-amber-300">DEGRADED</span>
          </div>
          <span className="text-[10px] text-cyber-400 block mt-0.5 font-sans">Active SMB Buffer Sweep</span>
        </div>

        <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800">
          <span className="text-[10px] text-cyber-500 uppercase block">Active Ingress Flows</span>
          <span className="text-sm font-bold text-cyber-100 block mt-1">14,820</span>
          <span className="text-[10px] text-cyan-400 block mt-0.5 font-sans">Rate: 24,510 pps</span>
        </div>

        <div className="p-3 rounded-lg bg-cyber-950/80 border border-red-500/50 shadow-red-glow/10">
          <span className="text-[10px] text-red-400 uppercase block">Suspicious Conduits</span>
          <span className="text-sm font-bold text-red-400 block mt-1">3 Flagged Conduits</span>
          <span className="text-[10px] text-red-300 block mt-0.5 font-sans">Lateral pivot staged</span>
        </div>

        <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800">
          <span className="text-[10px] text-cyber-500 uppercase block">Calculated Risk Score</span>
          <span className="text-sm font-bold text-amber-400 block mt-1">54 / 100</span>
          <span className="text-[10px] text-cyber-400 block mt-0.5 font-sans">Escalating to 88/100</span>
        </div>
      </div>

      {/* 3. MITRE Kill-Chain Trajectory Ribbon */}
      <CyberPanel
        title="Attack Progression Ribbon (MITRE ATT&CK)"
        subtitle="Historical Stages &rarr; Current Active Foothold &rarr; Imminent Predicted Pivots"
        accent="red"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 font-mono text-xs">
          {stages.map((st, idx) => {
            const isSelected = selectedStage?.techniqueId === st.techniqueId;
            const isCurrent = st.status === 'current';
            const isPredicted = st.status === 'predicted';
            const isPassed = st.status === 'passed';

            return (
              <div
                key={st.techniqueId}
                onClick={() => {
                  setSelectedStage(st);
                  const matchingDev = devices.find((d) => d.id === st.targetHostId);
                  if (matchingDev) setSelectedDevice(matchingDev);
                }}
                className={`cursor-pointer rounded-lg p-2.5 border transition-all select-none ${
                  isSelected
                    ? 'ring-1 ring-cyan-400 border-cyan-400 shadow-cyan-glow/30 bg-cyber-850'
                    : isCurrent
                    ? 'bg-red-950/40 border-red-500 shadow-red-glow/20'
                    : isPredicted
                    ? 'bg-amber-950/30 border-amber-500'
                    : isPassed
                    ? 'bg-cyber-950/80 border-cyber-800 opacity-75'
                    : 'bg-cyber-950/40 border-cyber-850 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-cyber-500 font-bold">#{idx + 1}</span>
                  {isCurrent && <Badge variant="critical" size="xs" pulse>ACTIVE</Badge>}
                  {isPredicted && <Badge variant="high" size="xs">PREDICTED</Badge>}
                  {isPassed && <span className="text-emerald-400 text-[9px] font-bold">DONE</span>}
                </div>

                <h4 className="font-bold text-cyber-100 text-xs truncate">{st.phase}</h4>
                <span className="text-[10px] text-cyan-300 block truncate">{st.techniqueId}</span>

                <div className="mt-1.5 pt-1.5 border-t border-cyber-800 flex justify-between text-[10px]">
                  <span className="text-cyber-500">P(Trans)</span>
                  <span className={`font-bold ${isCurrent ? 'text-red-400' : isPredicted ? 'text-amber-400' : 'text-cyber-400'}`}>
                    {((st.transitionProbability ?? st.probability) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CyberPanel>

      {/* 4. Primary Visual: Interactive 3D Network Graph Canvas & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SVG Network Graph Canvas */}
        <div className="lg:col-span-8">
          <CyberPanel
            title="Spatial Network State Graph"
            subtitle="Nodes = IPs & Devices &bull; Edges = Active Communication Conduits &bull; Intensity = Risk"
            accent="cyan"
            actions={
              <button
                onClick={() => setFilterSuspiciousOnly(!filterSuspiciousOnly)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                  filterSuspiciousOnly
                    ? 'bg-red-950 border-red-500 text-red-300'
                    : 'bg-cyber-900 border-cyber-700 text-cyber-400'
                }`}
              >
                <Filter className="h-3 w-3" />
                <span>{filterSuspiciousOnly ? 'SUSPICIOUS CONDUITS ONLY' : 'ALL NETWORK CONDUITS'}</span>
              </button>
            }
          >
            <div className="relative w-full h-[330px] bg-cyber-950/90 rounded-lg border border-cyber-800/90 overflow-hidden select-none backdrop-blur-md">
              <svg viewBox="0 0 720 330" className="w-full h-full">
                {/* Zones */}
                <rect x="20" y="40" width="120" height="255" rx="8" fill="#10192A" fillOpacity="0.4" stroke="#1E3050" strokeDasharray="3 3" />
                <text x="80" y="30" fill="#6085C0" fontSize="9" fontFamily="monospace" textAnchor="middle">WAN INGRESS</text>

                <rect x="180" y="40" width="120" height="255" rx="8" fill="#10192A" fillOpacity="0.4" stroke="#1E3050" strokeDasharray="3 3" />
                <text x="240" y="30" fill="#6085C0" fontSize="9" fontFamily="monospace" textAnchor="middle">DMZ PERIMETER</text>

                <rect x="360" y="40" width="160" height="255" rx="8" fill="#10192A" fillOpacity="0.4" stroke="#1E3050" strokeDasharray="3 3" />
                <text x="440" y="30" fill="#6085C0" fontSize="9" fontFamily="monospace" textAnchor="middle">CORE ENTERPRISE</text>

                <rect x="560" y="40" width="140" height="255" rx="8" fill="#10192A" fillOpacity="0.4" stroke="#1E3050" strokeDasharray="3 3" />
                <text x="630" y="30" fill="#6085C0" fontSize="9" fontFamily="monospace" textAnchor="middle">DOMAIN CONTROLLER</text>

                {/* Edges */}
                {filteredLinks.map((lnk) => {
                  const src = devices.find((d) => d.id === lnk.sourceId);
                  const tgt = devices.find((d) => d.id === lnk.targetId);
                  if (!src || !tgt) return null;

                  const isSelected = selectedLink?.id === lnk.id;

                  return (
                    <g
                      key={lnk.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedLink(lnk);
                        setSelectedDevice(tgt);
                      }}
                    >
                      <line
                        x1={src.x}
                        y1={src.y}
                        x2={tgt.x}
                        y2={tgt.y}
                        stroke={lnk.isSuspicious ? (isSelected ? '#00F0FF' : '#EF4444') : '#2B436D'}
                        strokeWidth={isSelected ? 3 : lnk.isSuspicious ? 2 : 1}
                        strokeDasharray={lnk.isSuspicious ? '5 3' : undefined}
                      />
                      <rect
                        x={(src.x + tgt.x) / 2 - 22}
                        y={(src.y + tgt.y) / 2 - 7}
                        width="44"
                        height="14"
                        rx="3"
                        fill="#060A10"
                        stroke={lnk.isSuspicious ? '#EF4444' : '#1E3050'}
                        strokeWidth="1"
                      />
                      <text
                        x={(src.x + tgt.x) / 2}
                        y={(src.y + tgt.y) / 2 + 4}
                        fill={lnk.isSuspicious ? '#EF4444' : '#93B3E6'}
                        fontSize="8"
                        fontFamily="monospace"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        :{lnk.port}
                      </text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {devices.map((dev) => {
                  const isSelected = selectedDevice?.id === dev.id;
                  const isCompromised = dev.status === 'compromised';
                  const isTargeted = dev.status === 'targeted';
                  const nodeColor = isCompromised ? '#EF4444' : isTargeted ? '#F59E0B' : '#10B981';

                  return (
                    <g
                      key={dev.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedDevice(dev);
                        setSelectedLink(null);
                      }}
                    >
                      {isSelected && (
                        <circle cx={dev.x} cy={dev.y} r="22" fill="none" stroke="#00F0FF" strokeWidth="2" />
                      )}
                      {(isCompromised || isTargeted) && (
                        <circle cx={dev.x} cy={dev.y} r="20" fill="none" stroke={nodeColor} strokeWidth="1" opacity="0.6" className="animate-ping" style={{ animationDuration: '3s' }} />
                      )}
                      <circle cx={dev.x} cy={dev.y} r="14" fill="#0B111D" stroke={nodeColor} strokeWidth="2.5" />
                      <circle cx={dev.x} cy={dev.y} r="5" fill={nodeColor} />
                      <text x={dev.x} y={dev.y + 25} fill="#EBF3FE" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                        {dev.name.length > 15 ? dev.name.slice(0, 14) + '…' : dev.name}
                      </text>
                      <text x={dev.x} y={dev.y + 35} fill="#6085C0" fontSize="8" fontFamily="monospace" textAnchor="middle">
                        {dev.ip}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="mt-2 text-[10px] font-mono text-cyber-400 flex justify-between">
              <span>Click any node (IP) or edge to inspect telemetry.</span>
              <span className="text-red-400 font-bold">Red = Compromised Foothold &bull; Amber = Target Pivot</span>
            </div>
          </CyberPanel>
        </div>

        {/* Selected Host Inspector */}
        <div className="lg:col-span-4 space-y-4">
          {selectedDevice && (
            <CyberPanel
              title={`Node // ${selectedDevice.name}`}
              subtitle={selectedDevice.ip}
              accent={selectedDevice.status === 'compromised' ? 'red' : 'cyan'}
              badge={
                <Badge variant={selectedDevice.status === 'compromised' ? 'critical' : 'high'} size="xs">
                  {selectedDevice.status.toUpperCase()}
                </Badge>
              }
            >
              <div className="space-y-3 font-mono text-xs">
                <div className="p-2 rounded bg-cyber-950/80 border border-cyber-800">
                  <span className="text-[9px] text-cyber-500 uppercase block">Infrastructure Role</span>
                  <span className="text-cyber-100 font-bold">{selectedDevice.role}</span>
                  <span className="text-[10px] text-cyber-400 block">{selectedDevice.subnet} &bull; {selectedDevice.os}</span>
                </div>

                <div className="p-2 rounded bg-cyber-950/80 border border-cyber-800">
                  <span className="text-[9px] text-cyber-500 uppercase block mb-1">Open Listening Ports</span>
                  <div className="flex gap-1 flex-wrap">
                    {selectedDevice.openPorts.map((p) => (
                      <span
                        key={p}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p === 445 || p === 135
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : 'bg-cyber-900 text-cyan-300 border border-cyber-800'
                        }`}
                      >
                        :{p}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-cyber-800 flex flex-col gap-2">
                  <Button
                    variant={selectedDevice.status === 'compromised' ? 'danger' : 'cyber'}
                    size="xs"
                    className="w-full"
                    onClick={() =>
                      showToast(
                        'Isolation Policy Dispatched',
                        `Preemptive micro-segmentation deployed for ${selectedDevice.name} (${selectedDevice.ip}).`,
                        'warning'
                      )
                    }
                  >
                    {selectedDevice.status === 'compromised' ? 'ISOLATE COMPROMISED NODE' : 'APPLY FIREWALL BARRIER'}
                  </Button>
                  <Link href="/forecast">
                    <Button variant="outline" size="xs" className="w-full">
                      PREDICT HORIZON S(t+K)
                    </Button>
                  </Link>
                </div>
              </div>
            </CyberPanel>
          )}
        </div>
      </div>
    </div>
  );
}
