'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Lock,
  ArrowRight,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  Info,
  Database,
  Sparkles,
} from 'lucide-react';
import { services } from '@/services';
import {
  BlockchainEvidence,
  EvidenceRecordItem,
  VerificationResult,
} from '@/types/blockchain';
import {
  mockBlockchainEvidence,
  mockEvidenceLedger,
} from '@/services/mock/mockData';
import { CyberPanel } from '@/components/ui/CyberPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function BlockchainPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [latestEvidence, setLatestEvidence] = useState<BlockchainEvidence>(mockBlockchainEvidence);
  const [evidenceLedger, setEvidenceLedger] = useState<EvidenceRecordItem[]>(mockEvidenceLedger);

  const [verifyInputHash, setVerifyInputHash] = useState<string>(mockBlockchainEvidence.predictionHash);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [selectedLedgerItem, setSelectedLedgerItem] = useState<EvidenceRecordItem>(mockEvidenceLedger[0]);

  const loadBlockchainData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [evidRes, ledgerRes] = await Promise.all([
        services.getBlockchainService().getLatestEvidence(),
        services.getBlockchainService().getEvidenceLedger(10),
      ]);

      if (evidRes.success) setLatestEvidence(evidRes.data);
      if (ledgerRes.success) setEvidenceLedger(ledgerRes.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to blockchain service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  const handleVerifyEvidence = async () => {
    if (!verifyInputHash.trim()) return;
    setIsVerifying(true);
    try {
      const res = await services.getBlockchainService().verifyEvidence(verifyInputHash);
      if (res.success) {
        setVerificationResult(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (error) {
    return (
      <div className="py-16">
        <ErrorState
          title="LEDGER SYNCHRONIZATION ERROR"
          message={error}
          onRetry={loadBlockchainData}
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
              CHAPTER 07 &bull; PROOF
            </span>
            <h1 className="text-xl font-mono font-bold text-cyber-100 uppercase tracking-wide">
              Prediction Becomes Trusted Evidence
            </h1>
          </div>
          <p className="text-sm text-cyber-300 font-sans mt-1">
            <strong className="text-cyan-300 font-mono">Core Theme:</strong> &quot;How do we know the prediction was not tampered with?&quot; &bull;{' '}
            <span className="text-cyber-400">
              AI prediction snapshots and forensic telemetry are cryptographically anchored to a decentralized consensus ledger.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/threat-intelligence">
            <Button variant="primary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              NEXT: 08 THREAT INTEL
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Primary Visual: Cryptographic Verification Flow Diagram */}
      <CyberPanel
        title="Visual Cryptographic Verification Flow: Event → Digest → Block → Seal"
        subtitle="End-to-end evidence anchoring from neural inference to trusted shared intelligence"
      >
        <div className="grid grid-cols-1 md:grid-cols-11 gap-1.5 items-center py-2 text-center font-mono text-xs">
          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyber-500 block uppercase">1. Event</span>
            <span className="font-bold text-cyber-200 text-xs block mt-0.5">Prediction</span>
            <span className="text-[9px] text-cyber-400 font-sans">State S(t+K)</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyber-500 block uppercase">2. Package</span>
            <span className="font-bold text-cyber-200 text-xs block mt-0.5">Metadata</span>
            <span className="text-[9px] text-cyber-400 font-sans">Model Card</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyan-500/50">
            <span className="text-[9px] text-cyan-400 block uppercase">3. Digest</span>
            <span className="font-bold text-cyan-200 text-xs block mt-0.5">SHA-256</span>
            <span className="text-[9px] text-cyber-300 font-sans">State Hash</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-750">
            <span className="text-[9px] text-cyber-500 block uppercase">4. Ledger</span>
            <span className="font-bold text-cyber-200 text-xs block mt-0.5">Blockchain</span>
            <span className="text-[9px] text-cyber-400 font-sans">Block #{latestEvidence.blockNumber}</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80">
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }}>
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>

          <div className="p-2.5 rounded bg-emerald-950/50 border border-emerald-500/60 text-emerald-300 shadow-emerald-glow/20">
            <span className="text-[9px] text-emerald-400 block uppercase">5. Trust</span>
            <span className="font-bold text-xs block mt-0.5">Verified Seal</span>
            <span className="text-[9px] text-emerald-200 font-sans">Tamper-Proof</span>
          </div>
        </div>

        {/* Evaluation Disclaimer */}
        <div className="mt-3 p-2.5 rounded-lg bg-cyber-950/80 border border-cyber-800 text-[11px] font-sans text-cyber-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>
              <strong className="text-cyan-300 font-mono">Evaluation Mode:</strong> Running on simulated Besu-PoA consensus. SHA-256 cryptographic digests are mathematically genuine; production Web3 RPC nodes can be hot-swapped via <code className="text-cyber-200 font-mono">IBlockchainService</code>.
            </span>
          </div>
          <Badge variant="mock" size="xs">SIMULATION MODE</Badge>
        </div>
      </CyberPanel>

      {/* 3. Compact Technical Hash Block & Verification Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-4">
          <CyberPanel
            title="Evidence Record Metadata"
            subtitle="Forensic parameters anchored under ISO/IEC 27037 standards"
            accent="cyan"
            badge={
              <Badge variant="verified" size="xs" pulse>
                SEALED &bull; VERIFIED
              </Badge>
            }
          >
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                  <span className="text-[9px] text-cyber-500 uppercase block">Prediction ID</span>
                  <span className="text-cyber-100 font-semibold">{latestEvidence.eventId}</span>
                </div>
                <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                  <span className="text-[9px] text-cyber-500 uppercase block">Timestamp</span>
                  <span className="text-cyber-200">{latestEvidence.timestamp}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                  <span className="text-[9px] text-cyber-500 uppercase block">AI Model Version</span>
                  <span className="text-cyan-300 font-semibold">{latestEvidence.modelVersion}</span>
                </div>
                <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                  <span className="text-[9px] text-cyber-500 uppercase block">Predicted Stage</span>
                  <span className="text-amber-300 font-semibold">{latestEvidence.predictedAttackStage}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-750 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-cyber-500 uppercase">SHA-256 Cryptographic Evidence Hash</span>
                  <button
                    onClick={() => copyToClipboard(latestEvidence.predictionHash, 'evHash')}
                    className="text-cyber-400 hover:text-cyan-300 flex items-center gap-1 text-[10px]"
                  >
                    {copiedHash === 'evHash' ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-cyan-300 break-all select-all font-mono font-bold text-xs bg-cyber-900/60 p-2 rounded border border-cyber-800">
                  {latestEvidence.predictionHash}
                </div>
              </div>
            </div>
          </CyberPanel>
        </div>

        {/* Interactive Verification Test Panel */}
        <div className="lg:col-span-6 space-y-4">
          <CyberPanel
            title="Interactive Verification Portal"
            subtitle="Validate evidence hash against consensus Merkle root"
            accent="emerald"
          >
            <div className="space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-cyber-400 text-[10px] uppercase block">
                  Verify Prediction Hash / Merkle Leaf
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verifyInputHash}
                    onChange={(e) => setVerifyInputHash(e.target.value)}
                    placeholder="Enter SHA-256 hash (0x...)"
                    className="flex-1 bg-cyber-950 border border-cyber-750 px-2.5 py-1.5 rounded text-cyber-100 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleVerifyEvidence}
                    isLoading={isVerifying}
                    icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  >
                    VERIFY
                  </Button>
                </div>
              </div>

              {verificationResult ? (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/70 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-emerald-800/60 pb-1.5">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      MERKLE PROOF AUTHENTICATED
                    </span>
                    <Badge variant="live" size="xs">BLOCK #{verificationResult.blockNumber}</Badge>
                  </div>
                  <p className="text-[11px] text-cyber-200 font-sans leading-relaxed">
                    {verificationResult.auditSummary}
                  </p>
                  <div className="text-[10px] text-cyber-400 pt-1 border-t border-emerald-800/60 flex justify-between">
                    <span>Mechanism: {verificationResult.consensusMechanism}</span>
                    <span>Verified: {verificationResult.verifiedAt}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded bg-cyber-950/80 border border-cyber-800 text-[11px] text-cyber-400 font-sans">
                  Click <strong className="text-cyan-300 font-mono">VERIFY</strong> above to test cryptographic Merkle inclusion.
                </div>
              )}
            </div>
          </CyberPanel>
        </div>
      </div>

      {/* 4. Compact Ledger Table */}
      <CyberPanel
        title="Committed Blockchain Ledger Table"
        subtitle="Chronological sequence of sealed attack prediction snapshots"
        accent="emerald"
        badge={<Badge variant="neutral" size="xs">{evidenceLedger.length} BLOCKS</Badge>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-cyber-800 text-cyber-400 uppercase text-[10px] bg-cyber-950/80">
                <th className="py-2 px-3">Block</th>
                <th className="py-2 px-3">Event ID</th>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Threat Profile</th>
                <th className="py-2 px-3">SHA-256 Digest</th>
                <th className="py-2 px-3 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-850">
              {evidenceLedger.map((rec) => {
                const isSelected = selectedLedgerItem.eventId === rec.eventId;

                return (
                  <tr
                    key={rec.eventId}
                    onClick={() => {
                      setSelectedLedgerItem(rec);
                      setVerifyInputHash(rec.predictionHash);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-950/20' : 'hover:bg-cyber-850/40'
                    }`}
                  >
                    <td className="py-2 px-3 font-bold text-cyber-100">#{rec.blockNumber}</td>
                    <td className="py-2 px-3 text-cyan-300">{rec.eventId}</td>
                    <td className="py-2 px-3 text-cyber-400 whitespace-nowrap">{rec.timestamp}</td>
                    <td className="py-2 px-3 text-cyber-200">{rec.threatId}</td>
                    <td className="py-2 px-3 text-cyber-300 font-mono">
                      {rec.predictionHash.slice(0, 14)}...{rec.predictionHash.slice(-6)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Badge variant={rec.verificationStatus === 'VERIFIED' ? 'verified' : 'high'} size="xs">
                        {rec.verificationStatus}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CyberPanel>
    </div>
  );
}
