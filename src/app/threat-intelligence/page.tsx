'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Globe2,
  Share2,
  Search,
  CheckCircle2,
  ArrowRight,
  X,
  Send,
  Sparkles,
} from 'lucide-react';
import { services } from '@/services';
import {
  ThreatIntelligenceFeed,
  ThreatIndicator,
  ThreatIndicatorType,
  TlpLevel,
} from '@/types/threat-intel';
import { mockThreatFeed, mockThreatIndicators } from '@/services/mock/mockData';
import { CyberPanel } from '@/components/ui/CyberPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function ThreatIntelPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feed, setFeed] = useState<ThreatIntelligenceFeed>(mockThreatFeed);
  const [indicators, setIndicators] = useState<ThreatIndicator[]>(mockThreatIndicators);
  const [selectedIoC, setSelectedIoC] = useState<ThreatIndicator>(mockThreatIndicators[0]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [newIndicatorValue, setNewIndicatorValue] = useState('');
  const [newIndicatorType, setNewIndicatorType] = useState<ThreatIndicatorType>('ipv4');
  const [newIndicatorActor, setNewIndicatorActor] = useState('');
  const [newIndicatorStage, setNewIndicatorStage] = useState('Initial Access');
  const [newIndicatorTechnique, setNewIndicatorTechnique] = useState('T1190 - Exploit Public-Facing App');
  const [newIndicatorTlp, setNewIndicatorTlp] = useState<TlpLevel>('AMBER');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const loadFeedData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await services.getThreatIntelService().getThreatFeed();
      if (res.success) {
        setFeed(res.data);
        setIndicators(res.data.indicators);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sync with threat intelligence nexus');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedData();
  }, []);

  const handleApplyFilter = async () => {
    try {
      const res = await services.getThreatIntelService().getIndicators({
        stage: selectedStage,
        search: searchQuery,
      });
      if (res.success) {
        setIndicators(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    handleApplyFilter();
  }, [searchQuery, selectedStage]);

  const handleShareIndicator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndicatorValue.trim()) return;

    setIsBroadcasting(true);
    try {
      const res = await services.getThreatIntelService().shareIndicator({
        type: newIndicatorType,
        value: newIndicatorValue,
        threatActor: newIndicatorActor || 'Unattributed Exploit Cluster',
        attackStage: newIndicatorStage,
        mitreTechnique: newIndicatorTechnique,
        threatFingerprint: `sha256: 0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 8)}`,
        confidence: 90,
        sourceOrganization: 'Internal SOC Node IND-WEST-01',
        lastObserved: 'Just now',
        tlp: newIndicatorTlp,
        tags: ['federated-broadcast', 'zero-trust'],
      });

      if (res.success) {
        setIndicators((prev) => [res.data, ...prev]);
        setFeed((prev) => ({
          ...prev,
          totalIoCs: prev.totalIoCs + 1,
        }));
        setShareSuccess(true);
        setTimeout(() => {
          setShareSuccess(false);
          setIsShareModalOpen(false);
          setNewIndicatorValue('');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBroadcasting(false);
    }
  };

  if (error) {
    return (
      <div className="py-16">
        <ErrorState
          title="FEDERATED THREAT NEXUS UNREACHABLE"
          message={error}
          onRetry={loadFeedData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative z-10">
      {/* 1. Evaluator Purpose Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 shadow-cyan-glow/30">
              CHAPTER 08 &bull; INTEL
            </span>
            <h1 className="text-xl font-mono font-bold text-cyber-100 uppercase tracking-wide">
              Threat Signal Propagates into Shared Intelligence
            </h1>
          </div>
          <p className="text-sm text-cyber-300 font-sans mt-1">
            <strong className="text-cyan-300 font-mono">Core Theme:</strong> &quot;How does threat intelligence propagate?&quot; &bull;{' '}
            <span className="text-cyber-400">
              Local detection markers and MITRE fingerprints syndicate across sovereign defense nodes for community immunity.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareModalOpen(true)}
            icon={<Share2 className="h-3.5 w-3.5" />}
          >
            BROADCAST IoC
          </Button>
          <Link href="/dashboard">
            <Button variant="primary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              NEXT: 09 DEFENDER DECISION
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Primary Visual: Threat Relationship Flow Diagram */}
      <CyberPanel
        title="Visual Threat Relationship Flow: Local Detection → Syndicated Immunity"
        subtitle="End-to-end intelligence sharing from local detection to collective community protection"
      >
        <div className="grid grid-cols-1 md:grid-cols-9 gap-1.5 items-center py-2 text-center font-mono text-xs">
          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyber-500 block uppercase">1. Trigger</span>
            <span className="font-bold text-cyber-200 text-xs block mt-0.5">Detected Threat</span>
            <span className="text-[9px] text-cyber-400 font-sans">SMBGhost Exploit</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyber-500 block uppercase">2. Fingerprint</span>
            <span className="font-bold text-cyan-300 text-xs block mt-0.5">Behavior Pattern</span>
            <span className="text-[9px] text-cyber-400 font-sans">SYN + SMB Variance</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyber-950/80 border border-amber-500/50">
            <span className="text-[9px] text-amber-400 block uppercase">3. Kill-Chain</span>
            <span className="font-bold text-amber-200 text-xs block mt-0.5">MITRE Technique</span>
            <span className="text-[9px] text-cyber-300 font-sans">T1190 / T1021</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-emerald-950/50 border border-emerald-500/60 text-emerald-300 shadow-emerald-glow/20">
            <span className="text-[9px] text-emerald-400 block uppercase">4. Federation</span>
            <span className="font-bold text-xs block mt-0.5">Shared Intel</span>
            <span className="text-[9px] text-emerald-200 font-sans">STIX 2.1 Syndicated</span>
          </div>
        </div>

        <div className="mt-2.5 p-2 rounded bg-cyber-950/80 border border-cyber-800 text-[11px] font-sans text-cyber-300 flex items-center justify-between">
          <span>
            🌐 <strong className="text-cyan-300 font-mono">Collective Immunity:</strong> {feed.totalIoCs.toLocaleString()} indicators synchronized across {feed.participatingNodes} sovereign CERT & enterprise defense nodes.
          </span>
          <span className="text-emerald-400 font-mono text-[10px] font-semibold shrink-0">
            CONSENSUS: {feed.peerConsensusRate}%
          </span>
        </div>
      </CyberPanel>

      {/* 3. Indicators List & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-3">
          <CyberPanel
            title="Federated Threat Indicators"
            subtitle="Vetted Indicators of Compromise mapped to attack trajectory"
            accent="cyan"
            actions={
              <div className="flex items-center gap-2 font-mono text-xs">
                <div className="relative">
                  <Search className="h-3 w-3 text-cyber-500 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Search IoC..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-cyber-950 border border-cyber-750 rounded px-2 py-1 pl-7 text-xs text-cyber-100 font-mono w-32 sm:w-40 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="bg-cyber-950 border border-cyber-750 rounded px-2 py-1 text-xs text-cyber-300 font-mono"
                >
                  <option value="ALL">All Stages</option>
                  <option value="Reconnaissance">Recon</option>
                  <option value="Initial Access">Initial Access</option>
                  <option value="Lateral Movement">Lateral</option>
                  <option value="Command & Control">C2</option>
                  <option value="Exfiltration">Exfiltration</option>
                </select>
              </div>
            }
          >
            <div className="space-y-2 font-mono text-xs">
              {indicators.map((ioc) => {
                const isSelected = selectedIoC.id === ioc.id;

                return (
                  <div
                    key={ioc.id}
                    onClick={() => setSelectedIoC(ioc)}
                    className={`cursor-pointer p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-400 shadow-cyan-glow/20'
                        : 'bg-cyber-950/80 border-cyber-800 hover:border-cyber-750'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-300 font-bold text-xs">{ioc.value}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-cyber-900 text-cyber-400 border border-cyber-800">
                          {ioc.type}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                            ioc.tlp === 'RED'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : ioc.tlp === 'AMBER'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {ioc.tlp}
                        </span>
                      </div>
                      <div className="text-[11px] text-cyber-400 font-sans mt-1">
                        {ioc.threatActor} &bull; <span className="text-amber-300 font-mono">{ioc.attackStage}</span> &bull; {ioc.mitreTechnique}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-cyber-200 font-bold text-xs">{ioc.confidence}% Confidence</div>
                      <Badge variant="verified" size="xs">
                        {ioc.verificationStatus.replace('-VERIFIED', '')}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CyberPanel>
        </div>

        {/* Threat Card Detail & Next Steps */}
        <div className="lg:col-span-4 space-y-4">
          <CyberPanel
            title={`Threat Detail // ${selectedIoC.value}`}
            subtitle="STIX 2.1 Structured Object"
            accent="cyan"
          >
            <div className="space-y-3 font-mono text-xs">
              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                <span className="text-[9px] text-cyber-500 uppercase block">MITRE Kill-Chain Mapping</span>
                <span className="text-cyan-300 font-bold block mt-0.5">{selectedIoC.mitreTechnique}</span>
                <span className="text-amber-300 text-[11px] block mt-0.5">Stage: {selectedIoC.attackStage}</span>
              </div>

              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800 space-y-1">
                <span className="text-[9px] text-cyber-500 uppercase block">Fingerprint Digest</span>
                <span className="text-cyber-200 text-[10px] break-all block">{selectedIoC.threatFingerprint}</span>
              </div>

              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                <span className="text-[9px] text-cyber-500 uppercase block">Source Node</span>
                <span className="text-cyber-200 block mt-0.5 font-sans text-xs">{selectedIoC.sourceOrganization}</span>
              </div>

              <div className="pt-2 border-t border-cyber-800 flex flex-col gap-2">
                <Link href="/dashboard">
                  <Button variant="cyber" size="sm" className="w-full" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                    TRAVEL TO 09 DEFENDER DECISION
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
        </div>
      </div>

      {/* Broadcast Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-cyber-900 border border-cyber-700 rounded-xl p-5 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-cyber-800 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-cyber-100 uppercase">
                  Broadcast Threat Indicator (STIX 2.1)
                </h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-cyber-400 hover:text-cyber-100 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {shareSuccess ? (
              <div className="p-4 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-sm">INDICATOR BROADCAST SUCCESSFUL</h4>
                <p className="text-xs font-sans text-cyber-300">
                  Signed and syndicated to 42 peer national defense nodes.
                </p>
              </div>
            ) : (
              <form onSubmit={handleShareIndicator} className="space-y-3">
                <div>
                  <label className="text-cyber-400 text-[10px] uppercase block mb-1">Indicator Value</label>
                  <input
                    type="text"
                    required
                    value={newIndicatorValue}
                    onChange={(e) => setNewIndicatorValue(e.target.value)}
                    placeholder="e.g. 198.51.100.200 or malicious-domain.top"
                    className="w-full bg-cyber-950 border border-cyber-700 rounded px-3 py-1.5 text-cyber-100 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-cyber-400 text-[10px] uppercase block mb-1">Type</label>
                    <select
                      value={newIndicatorType}
                      onChange={(e: any) => setNewIndicatorType(e.target.value)}
                      className="w-full bg-cyber-950 border border-cyber-700 rounded px-2.5 py-1.5 text-cyber-200 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="ipv4">IPv4 Address</option>
                      <option value="domain">Domain Name</option>
                      <option value="cve">CVE ID</option>
                      <option value="hash">File Hash</option>
                      <option value="pattern">Byte Pattern</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-cyber-400 text-[10px] uppercase block mb-1">TLP Protocol</label>
                    <select
                      value={newIndicatorTlp}
                      onChange={(e: any) => setNewIndicatorTlp(e.target.value)}
                      className="w-full bg-cyber-950 border border-cyber-700 rounded px-2.5 py-1.5 text-cyber-200 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="AMBER">TLP:AMBER</option>
                      <option value="RED">TLP:RED</option>
                      <option value="GREEN">TLP:GREEN</option>
                      <option value="WHITE">TLP:WHITE</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsShareModalOpen(false)}
                  >
                    CANCEL
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isBroadcasting}
                    icon={<Send className="h-3.5 w-3.5" />}
                  >
                    BROADCAST
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
