'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CyberPanel } from '@/components/ui/CyberPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TerminalBox } from '@/components/ui/TerminalBox';
import {
  ArrowRight,
  Search,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Cpu,
  Radio,
  Sparkles,
} from 'lucide-react';

interface FlowRecord {
  id: string;
  protocol: 'SMB' | 'TCP' | 'HTTP' | 'TLS' | 'DNS' | 'ICMP';
  srcIp: string;
  srcPort: number;
  dstIp: string;
  dstPort: number;
  synRate: number;
  entropy: number;
  iatVariance: number;
  anomalyScore: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'BENIGN';
  status: string;
  ttl: number;
  packetSizeAvg: number;
  retransmissions: number;
  fragmentation: string;
}

const MOCK_FLOWS: FlowRecord[] = [
  {
    id: 'FL-9081',
    protocol: 'SMB',
    srcIp: '198.51.100.188',
    srcPort: 49152,
    dstIp: '10.240.12.4',
    dstPort: 445,
    synRate: 480,
    entropy: 7.82,
    iatVariance: 0.12,
    anomalyScore: 0.94,
    severity: 'CRITICAL',
    status: 'Exploit Buffer Overflow Pattern (CVE-2020-0796)',
    ttl: 128,
    packetSizeAvg: 1420,
    retransmissions: 42,
    fragmentation: 'Offset 0x0180 (Anomalous)',
  },
  {
    id: 'FL-9080',
    protocol: 'HTTP',
    srcIp: '203.0.113.45',
    srcPort: 58210,
    dstIp: '10.240.10.1',
    dstPort: 80,
    synRate: 35,
    entropy: 4.12,
    iatVariance: 14.8,
    anomalyScore: 0.12,
    severity: 'BENIGN',
    status: 'Standard HTTP Web Gateway Ingress',
    ttl: 54,
    packetSizeAvg: 680,
    retransmissions: 1,
    fragmentation: 'None (DF Set)',
  },
  {
    id: 'FL-9079',
    protocol: 'TLS',
    srcIp: '198.51.100.74',
    srcPort: 443,
    dstIp: '10.240.14.88',
    dstPort: 52190,
    synRate: 15,
    entropy: 6.91,
    iatVariance: 3.4,
    anomalyScore: 0.88,
    severity: 'HIGH',
    status: 'High Shannon Entropy TLS Stager Delivery',
    ttl: 64,
    packetSizeAvg: 1240,
    retransmissions: 18,
    fragmentation: 'None',
  },
  {
    id: 'FL-9078',
    protocol: 'DNS',
    srcIp: '10.240.14.88',
    srcPort: 53102,
    dstIp: '198.51.100.22',
    dstPort: 53,
    synRate: 8,
    entropy: 7.45,
    iatVariance: 60.2,
    anomalyScore: 0.82,
    severity: 'HIGH',
    status: 'Periodic Covert TXT Record Tunneling',
    ttl: 128,
    packetSizeAvg: 310,
    retransmissions: 6,
    fragmentation: 'None',
  },
  {
    id: 'FL-9077',
    protocol: 'TCP',
    srcIp: '198.51.100.188',
    srcPort: 41022,
    dstIp: '10.240.12.2',
    dstPort: 135,
    synRate: 210,
    entropy: 5.34,
    iatVariance: 0.45,
    anomalyScore: 0.76,
    severity: 'MEDIUM',
    status: 'MSRPC Endpoint Mapper Probe Sweep',
    ttl: 112,
    packetSizeAvg: 84,
    retransmissions: 8,
    fragmentation: 'None',
  },
  {
    id: 'FL-9076',
    protocol: 'ICMP',
    srcIp: '10.240.10.1',
    srcPort: 0,
    dstIp: '10.240.12.1',
    dstPort: 0,
    synRate: 2,
    entropy: 2.10,
    iatVariance: 100.0,
    anomalyScore: 0.05,
    severity: 'BENIGN',
    status: 'Internal Heartbeat Keep-Alive',
    ttl: 64,
    packetSizeAvg: 64,
    retransmissions: 0,
    fragmentation: 'None',
  },
];

export default function AnalysisPage() {
  const [selectedProtocol, setSelectedProtocol] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFlow, setSelectedFlow] = useState<FlowRecord>(MOCK_FLOWS[0]);
  const [showFeatureDrawer, setShowFeatureDrawer] = useState<boolean>(true);

  const filteredFlows = MOCK_FLOWS.filter((flow) => {
    const matchesProtocol = selectedProtocol === 'ALL' || flow.protocol === selectedProtocol;
    const matchesSearch =
      searchQuery === '' ||
      flow.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flow.srcIp.includes(searchQuery) ||
      flow.dstIp.includes(searchQuery) ||
      flow.status.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProtocol && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative z-10">
      {/* 1. Evaluator Purpose Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 shadow-cyan-glow/30">
              CHAPTER 02 &bull; ANALYZE
            </span>
            <h1 className="text-xl font-mono font-bold text-cyber-100 uppercase tracking-wide">
              Traffic Moves Through the Network
            </h1>
          </div>
          <p className="text-sm text-cyber-300 font-sans mt-1">
            <strong className="text-cyan-300 font-mono">Core Theme:</strong> &quot;How is traffic moving through the network conduits?&quot; &bull;{' '}
            <span className="text-cyber-400">
              Dissecting packet streams into 5-tuple socket flows and Shannon entropy spikes.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/attack-path">
            <Button variant="primary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              NEXT: 03 NETWORK STATE
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Primary Visual: Interactive Network Topology (SOURCE → NETWORK FLOWS → DESTINATION) */}
      <CyberPanel
        title="Interactive Network Flow Topology: Source → Conduits → Destination"
        subtitle="Animated telemetry streams visualizing protocols, ports, and anomalous lateral propagation"
        accent="cyan"
      >
        <div className="relative w-full h-[320px] bg-cyber-950/90 rounded-lg border border-cyber-800/90 overflow-hidden select-none backdrop-blur-md">
          <svg viewBox="0 0 880 320" className="w-full h-full">
            <defs>
              <linearGradient id="cyanFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="redFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.3" />
              </linearGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Subnet Regions */}
            <rect x="20" y="25" width="190" height="270" rx="8" fill="#10192A" fillOpacity="0.3" stroke="#1E3050" strokeDasharray="4 4" />
            <text x="115" y="45" fill="#6085C0" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">SOURCE SUBNETS</text>

            <rect x="340" y="25" width="200" height="270" rx="8" fill="#0c1527" fillOpacity="0.4" stroke="#00F0FF" strokeOpacity="0.2" strokeDasharray="3 3" />
            <text x="440" y="45" fill="#00F0FF" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">ACTIVE FLOW CONDUITS</text>

            <rect x="670" y="25" width="190" height="270" rx="8" fill="#10192A" fillOpacity="0.3" stroke="#1E3050" strokeDasharray="4 4" />
            <text x="765" y="45" fill="#6085C0" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">TARGET DESTINATIONS</text>

            {/* Connecting Stream Paths & Nodes */}
            {MOCK_FLOWS.map((flow, index) => {
              const ySrc = 75 + index * 42;
              const yDst = 75 + ((index * 3) % 6) * 42;
              const isSelected = selectedFlow.id === flow.id;
              const isCrit = flow.severity === 'CRITICAL';
              const isHigh = flow.severity === 'HIGH';

              const strokeColor = isCrit ? '#EF4444' : isHigh ? '#F59E0B' : '#00F0FF';
              const strokeOpacity = isSelected ? 1 : 0.45;
              const strokeWidth = isSelected ? 3 : isCrit ? 2.5 : 1.5;

              return (
                <g key={flow.id} className="cursor-pointer" onClick={() => setSelectedFlow(flow)}>
                  {/* Bezier Conduit Curve */}
                  <path
                    d={`M 195 ${ySrc} C 300 ${ySrc}, 320 ${ySrc}, 440 ${ySrc} C 560 ${ySrc}, 580 ${yDst}, 685 ${yDst}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    strokeDasharray={isCrit ? '6 4' : undefined}
                    filter={isSelected ? 'url(#glowFilter)' : undefined}
                  />

                  {/* Animated Stream Particle along conduit */}
                  <circle r={isSelected ? 4 : 2.5} fill={strokeColor}>
                    <animateMotion
                      path={`M 195 ${ySrc} C 300 ${ySrc}, 320 ${ySrc}, 440 ${ySrc} C 560 ${ySrc}, 580 ${yDst}, 685 ${yDst}`}
                      dur={isCrit ? '1.8s' : '3.2s'}
                      repeatCount="indefinite"
                    />
                  </circle>

                  {/* Source Node Button */}
                  <rect
                    x="35"
                    y={ySrc - 14}
                    width="160"
                    height="28"
                    rx="5"
                    fill={isSelected ? '#1A2942' : '#0B132B'}
                    stroke={isSelected ? '#00F0FF' : isCrit ? '#EF4444' : '#1E3050'}
                    strokeWidth={isSelected ? 1.5 : 1}
                  />
                  <circle cx="50" cy={ySrc} r="4" fill={isCrit ? '#EF4444' : '#00F0FF'} />
                  <text x="62" y={ySrc - 1} fill="#E2E8F0" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    {flow.srcIp}
                  </text>
                  <text x="62" y={ySrc + 9} fill="#94A3B8" fontSize="8" fontFamily="monospace">
                    :{flow.srcPort} &bull; {flow.protocol}
                  </text>

                  {/* Middle Conduit Badge */}
                  <rect
                    x="370"
                    y={ySrc - 12}
                    width="140"
                    height="24"
                    rx="4"
                    fill="#060A10"
                    stroke={strokeColor}
                    strokeWidth="1"
                  />
                  <text x="440" y={ySrc + 3} fill={strokeColor} fontSize="8.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                    {flow.id} &bull; {flow.protocol} → :{flow.dstPort} ({flow.synRate} pps)
                  </text>

                  {/* Destination Node Button */}
                  <rect
                    x="685"
                    y={yDst - 14}
                    width="160"
                    height="28"
                    rx="5"
                    fill={isSelected ? '#1A2942' : '#0B132B'}
                    stroke={isSelected ? '#00F0FF' : isCrit ? '#EF4444' : '#1E3050'}
                    strokeWidth={isSelected ? 1.5 : 1}
                  />
                  <circle cx="700" cy={yDst} r="4" fill={isCrit ? '#EF4444' : '#10B981'} />
                  <text x="712" y={yDst - 1} fill="#E2E8F0" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    {flow.dstIp}
                  </text>
                  <text x="712" y={yDst + 9} fill="#94A3B8" fontSize="8" fontFamily="monospace">
                    Port {flow.dstPort} {isCrit ? '(Target File Server)' : flow.dstPort === 135 ? '(AD Domain Controller)' : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CyberPanel>

      {/* 3. Visual Extraction Pipeline Diagram */}
      <CyberPanel title="Traffic Extraction Flow: PCAP → Micro-Tensors" subtitle="From raw packet streams into decomposed temporal features">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center py-2 text-center font-mono text-xs">
          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyber-500 block uppercase">Input</span>
            <span className="font-bold text-cyber-200 text-xs block mt-0.5">PCAP Stream</span>
            <span className="text-[9px] text-cyber-400 font-sans">Raw Packets</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyan-400 block uppercase">Step A</span>
            <span className="font-bold text-cyan-200 text-xs block mt-0.5">Flow Extraction</span>
            <span className="text-[9px] text-cyber-400 font-sans">5-Tuple Sockets</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyan-400 block uppercase">Step B</span>
            <span className="font-bold text-cyan-200 text-xs block mt-0.5">Packet Analysis</span>
            <span className="text-[9px] text-cyber-400 font-sans">Entropy & IAT</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyan-950/60 border border-emerald-500/60 shadow-emerald-glow/20">
            <span className="text-[9px] text-emerald-400 block uppercase">Output</span>
            <span className="font-bold text-emerald-300 text-xs block mt-0.5">Feature Tensor</span>
            <span className="text-[9px] text-cyber-300 font-sans">World Model Ready</span>
          </div>
        </div>
      </CyberPanel>

      {/* 3. Feature Groups Breakdown */}
      <CyberPanel
        title="Extracted Feature Groups"
        subtitle="Decomposed flow and packet features feeding the AI World Model"
        actions={
          <button
            onClick={() => setShowFeatureDrawer(!showFeatureDrawer)}
            className="flex items-center gap-1 text-xs font-mono text-cyan-400 hover:text-cyan-300"
          >
            <span>{showFeatureDrawer ? 'COLLAPSE' : 'EXPAND'}</span>
            {showFeatureDrawer ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        }
      >
        {showFeatureDrawer && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 font-mono text-xs"
          >
            {/* Flow Features */}
            <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-750 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-cyber-800">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  FLOW-LEVEL CONDUITS
                </span>
                <Badge variant="cyan" size="xs">5-TUPLE AGGREGATION</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-1.5 rounded bg-cyber-900/60 border border-cyber-850">
                  <span className="text-cyber-500 block text-[9px]">Source Socket:</span>
                  <span className="text-cyber-200 font-semibold">{selectedFlow.srcIp}:{selectedFlow.srcPort}</span>
                </div>
                <div className="p-1.5 rounded bg-cyber-900/60 border border-cyber-850">
                  <span className="text-cyber-500 block text-[9px]">Destination Socket:</span>
                  <span className="text-cyber-200 font-semibold">{selectedFlow.dstIp}:{selectedFlow.dstPort}</span>
                </div>
                <div className="p-1.5 rounded bg-cyber-900/60 border border-cyber-850">
                  <span className="text-cyber-500 block text-[9px]">Transport Protocol:</span>
                  <span className="text-cyan-300 font-semibold">{selectedFlow.protocol}</span>
                </div>
                <div className="p-1.5 rounded bg-cyber-900/60 border border-cyber-850">
                  <span className="text-cyber-500 block text-[9px]">SYN Packet Rate:</span>
                  <span className="text-red-400 font-semibold">{selectedFlow.synRate} pps</span>
                </div>
              </div>
            </div>

            {/* Packet Features */}
            <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-750 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-cyber-800">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                  PACKET-LEVEL MICRO-TELEMETRY
                </span>
                <Badge variant="verified" size="xs">ENTROPY & IAT</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-1.5 rounded bg-cyber-900/60 border border-cyber-850">
                  <span className="text-cyber-500 block text-[9px]">Time-To-Live (TTL):</span>
                  <span className="text-cyber-200 font-semibold">{selectedFlow.ttl} hops</span>
                </div>
                <div className="p-1.5 rounded bg-cyber-900/60 border border-cyber-850">
                  <span className="text-cyber-500 block text-[9px]">Shannon Entropy:</span>
                  <span className="text-amber-300 font-semibold">{selectedFlow.entropy.toFixed(2)} b/B</span>
                </div>
                <div className="p-1.5 rounded bg-cyber-900/60 border border-cyber-850">
                  <span className="text-cyber-500 block text-[9px]">Inter-Arrival Time:</span>
                  <span className="text-cyber-200 font-semibold">{selectedFlow.iatVariance} ms variance</span>
                </div>
                <div className="p-1.5 rounded bg-cyber-900/60 border border-cyber-850">
                  <span className="text-cyber-500 block text-[9px]">Retransmissions:</span>
                  <span className="text-red-400 font-semibold">{selectedFlow.retransmissions} pkts</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </CyberPanel>

      {/* 4. Flows Table & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <CyberPanel
            title="Active Flow Ledger"
            subtitle="Click any row to update feature decomposition"
            actions={
              <div className="relative">
                <Search className="h-3 w-3 text-cyber-500 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Filter flow / IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-cyber-950 border border-cyber-750 rounded px-2 py-1 pl-7 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 w-36 sm:w-44"
                />
              </div>
            }
          >
            {/* Protocol Filters */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3 font-mono text-[11px]">
              <span className="text-cyber-500 mr-1 uppercase text-[10px]">Filter:</span>
              {['ALL', 'SMB', 'TCP', 'HTTP', 'TLS', 'DNS'].map((proto) => (
                <button
                  key={proto}
                  onClick={() => setSelectedProtocol(proto)}
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    selectedProtocol === proto
                      ? 'bg-cyan-950 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-cyber-900/80 border-cyber-800 text-cyber-400 hover:text-cyber-200'
                  }`}
                >
                  {proto}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-cyber-800 text-cyber-400 uppercase text-[10px] bg-cyber-950/80">
                    <th className="py-2 px-3">Flow ID</th>
                    <th className="py-2 px-3">Proto</th>
                    <th className="py-2 px-3">Source Socket</th>
                    <th className="py-2 px-3">Destination Socket</th>
                    <th className="py-2 px-3">Entropy</th>
                    <th className="py-2 px-3">Score</th>
                    <th className="py-2 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-850">
                  {filteredFlows.map((flow) => {
                    const isSelected = selectedFlow?.id === flow.id;
                    const isCrit = flow.severity === 'CRITICAL';
                    const isHigh = flow.severity === 'HIGH';

                    return (
                      <tr
                        key={flow.id}
                        onClick={() => setSelectedFlow(flow)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-cyan-950/60 border-l-2 border-cyan-400'
                            : isCrit
                            ? 'bg-red-950/20 hover:bg-red-950/30'
                            : isHigh
                            ? 'bg-amber-950/20 hover:bg-amber-950/30'
                            : 'hover:bg-cyber-850/40'
                        }`}
                      >
                        <td className="py-2 px-3 font-bold text-cyber-200">{flow.id}</td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            isCrit ? 'bg-red-950 text-red-400 border-red-800' : isHigh ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-cyber-850 text-cyber-300 border-cyber-700'
                          }`}>
                            {flow.protocol}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-cyber-300">{flow.srcIp}:{flow.srcPort}</td>
                        <td className="py-2 px-3 text-cyber-200 font-semibold">{flow.dstIp}:{flow.dstPort}</td>
                        <td className="py-2 px-3 text-cyber-300">{flow.entropy.toFixed(2)} b/B</td>
                        <td className="py-2 px-3 font-bold">
                          <span className={isCrit ? 'text-red-400' : isHigh ? 'text-amber-400' : 'text-emerald-400'}>
                            {flow.anomalyScore.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`text-[10px] ${isSelected ? 'text-cyan-300 font-bold' : 'text-cyber-500'}`}>
                            {isSelected ? 'ACTIVE' : 'SELECT'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CyberPanel>
        </div>

        {/* Selected Flow Inspector & Next Step */}
        <div className="lg:col-span-4 space-y-4">
          <CyberPanel
            title={`Flow Inspector // ${selectedFlow.id}`}
            subtitle="Micro-tensor attributes"
            accent={selectedFlow.severity === 'CRITICAL' ? 'red' : 'cyan'}
          >
            <div className="space-y-3 font-mono text-xs">
              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-cyber-500 uppercase">Detection Classification</span>
                  <Badge variant={selectedFlow.severity === 'CRITICAL' ? 'critical' : selectedFlow.severity === 'HIGH' ? 'high' : 'cyber'} size="xs">
                    {selectedFlow.severity}
                  </Badge>
                </div>
                <span className="text-cyber-100 font-semibold block font-sans text-xs mt-1">
                  {selectedFlow.status}
                </span>
              </div>

              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800 space-y-1 text-[11px]">
                <div className="flex justify-between text-cyber-400">
                  <span>Packet Size Avg:</span>
                  <span className="text-cyber-100">{selectedFlow.packetSizeAvg} bytes</span>
                </div>
                <div className="flex justify-between text-cyber-400">
                  <span>Fragmentation:</span>
                  <span className="text-cyber-100">{selectedFlow.fragmentation}</span>
                </div>
                <div className="flex justify-between text-cyber-400">
                  <span>Anomaly Probability:</span>
                  <span className="text-red-400 font-bold">{(selectedFlow.anomalyScore * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="pt-2 border-t border-cyber-800 flex flex-col gap-2">
                <Link href="/attack-path">
                  <Button variant="cyber" size="sm" className="w-full" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                    TRAVEL TO 03 NETWORK STATE
                  </Button>
                </Link>
                <Link href="/forecast">
                  <Button variant="outline" size="sm" className="w-full">
                    VIEW FUTURE FORECAST S(t+K)
                  </Button>
                </Link>
              </div>
            </div>
          </CyberPanel>

          {/* Kernel Log */}
          <TerminalBox
            title="EBPF KERNEL CONDUIT TRACE"
            lines={[
              '09:41:22.184 [eth0] Promiscuous packet filter engaged',
              '09:41:22.402 [ebpf] Aggregation table initialized: 65,536 buckets',
              '09:41:23.012 [anomaly] Flow FL-9081 tagged for high syn_rate + smb_frag',
              '09:41:23.018 [pipeline] Transmitting 5-tuple tensor to Prediction Service',
              '09:41:23.080 [shannon] Entropy spike detected on port 445: 7.82 bits/byte',
              '09:41:24.004 [state] State vector S(t) normalized and anchored',
            ]}
          />
        </div>
      </div>
    </div>
  );
}
