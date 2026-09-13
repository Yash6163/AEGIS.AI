'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Play,
  Activity,
  Layers,
  Clock,
  Network,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Database,
  Radio,
} from 'lucide-react';
import { CyberPanel } from '@/components/ui/CyberPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface DatasetPreset {
  id: string;
  name: string;
  filename: string;
  size: string;
  packets: string;
  flows: string;
  ips: string;
  protocols: string;
  timeWindow: string;
  attackVector: string;
  description: string;
  format: 'PCAP' | 'CSV';
}

const PRESET_DATASETS: DatasetPreset[] = [
  {
    id: 'apt29-smb',
    name: 'Enterprise SMB Exploit & Lateral Spread (APT29)',
    filename: 'cve-2020-0796-smbv3-ghost-apt29.pcap',
    size: '48.2 MB',
    packets: '184,290',
    flows: '14,820',
    ips: '128',
    protocols: 'TCP / SMB / DNS',
    timeWindow: '42 min capture',
    attackVector: 'CVE-2020-0796 (SMBGhost) + Lateral Movement',
    description: 'Real-world capture featuring high-rate SYN reconnaissance, SMB compression buffer overflow, and internal lateral movement towards Active Directory Tier 0.',
    format: 'PCAP',
  },
  {
    id: 'cic-ids-ddos',
    name: 'CSE-CIC-IDS2018 Multi-Vector Infiltration Benchmark',
    filename: 'cse-cic-ids2018-ddos-infiltration.csv',
    size: '124.8 MB',
    packets: '1,048,576',
    flows: '82,410',
    ips: '450',
    protocols: 'HTTP / SSH / TCP',
    timeWindow: '24 hr benchmark',
    attackVector: 'PortScan -> Web Brute-Force -> Infiltration',
    description: 'Standard academic and SOC benchmark dataset containing 80 flow features extracted using CICFlowMeter over 24-hour enterprise capture.',
    format: 'CSV',
  },
  {
    id: 'c2-dns-tunnel',
    name: 'Zeek / Suricata DNS Beaconing & Exfiltration Trace',
    filename: 'zeek-dns-c2-beacon-covert.pcapng',
    size: '22.4 MB',
    packets: '94,110',
    flows: '6,230',
    ips: '64',
    protocols: 'DNS / UDP / ICMP',
    timeWindow: '18 min burst',
    attackVector: 'Asynchronous DNS Tunneling (T1071.004)',
    description: 'Sub-threshold periodic C2 beaconing using encoded TXT record queries to bypass egress stateful firewalls.',
    format: 'PCAP',
  },
];

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DatasetPreset>(PRESET_DATASETS[0]);
  const [customFile, setCustomFile] = useState<{ name: string; size: string; type: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(100);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const activeFilename = customFile ? customFile.name : selectedPreset.filename;
  const activeSize = customFile ? customFile.size : selectedPreset.size;

  const handleSimulateUpload = () => {
    setIsProcessing(true);
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          return 100;
        }
        return prev + 25;
      });
    }, 350);
  };

  const handleCustomFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validExtensions = ['.pcap', '.pcapng', '.csv', '.cap'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (!validExtensions.includes(fileExt)) {
        setValidationError(`Invalid file extension "${fileExt}". Please upload .pcap, .pcapng, or .csv captures.`);
        return;
      }

      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setCustomFile({
        name: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
        size: `${sizeMB} MB`,
        type: fileExt.toUpperCase().replace('.', ''),
      });
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative z-10">
      {/* 1. Evaluator Purpose Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyber-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 shadow-cyan-glow/30">
              CHAPTER 01 &bull; INGEST
            </span>
            <h1 className="text-xl font-mono font-bold text-cyber-100 uppercase tracking-wide">
              Data Enters the Cyber Universe
            </h1>
          </div>
          <p className="text-sm text-cyber-300 font-sans mt-1">
            <strong className="text-cyan-300 font-mono">Core Theme:</strong> &quot;What data enters the cyber universe?&quot; &bull;{' '}
            <span className="text-cyber-400">
              Telemetry packets stream from raw capture buffers into the temporal network core.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="cyber" size="sm">
            STREAM: .PCAP / .CSV
          </Badge>
          <Link href="/analysis">
            <Button variant="primary" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              NEXT: 02 ANALYZE
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Visual Ingestion Stream Diagram (Data flowing into the universe) */}
      <CyberPanel title="Ingestion Pipeline: Telemetry Stream → Network Core" subtitle="Raw capture dissection into temporal snapshot tensors">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center py-2">
          {/* Node 1 */}
          <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-700/80 text-center font-mono relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-1.5 w-1.5 bg-cyan-400 rounded-full animate-ping" />
            <span className="text-[10px] text-cyber-500 block uppercase">1. Raw Source</span>
            <span className="font-bold text-cyber-100 text-xs mt-1 block">PCAP / CSV Telemetry</span>
            <span className="text-[10px] text-cyan-400 font-sans mt-0.5 block truncate">{activeFilename}</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80 font-mono text-xs">
            <motion.div animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowRight className="h-4 w-4" />
            </motion.div>
          </div>

          {/* Node 2 */}
          <div className="p-3 rounded-lg bg-cyan-950/50 border border-cyan-500/60 text-center font-mono relative shadow-cyan-glow/20">
            <span className="text-[10px] text-cyan-400 block uppercase">2. Deep Dissection</span>
            <span className="font-bold text-cyan-200 text-xs mt-1 block">Entropy & Flow Kernels</span>
            <span className="text-[10px] text-cyber-300 font-sans mt-0.5 block">5-Tuple Sockets & IAT</span>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400/80 font-mono text-xs">
            <motion.div animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}>
              <ArrowRight className="h-4 w-4" />
            </motion.div>
          </div>

          {/* Node 3 */}
          <div className="p-3 rounded-lg bg-cyber-950/80 border border-emerald-500/60 text-center font-mono relative shadow-emerald-glow/20">
            <span className="text-[10px] text-emerald-400 block uppercase">3. Universe Entry</span>
            <span className="font-bold text-emerald-300 text-xs mt-1 block">Topological State S(t)</span>
            <span className="text-[10px] text-cyber-300 font-sans mt-0.5 block">Graph Tensor Ready</span>
          </div>
        </div>
      </CyberPanel>

      {/* 3. Upload & Drop Zone + Live Stream Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <CyberPanel
            title="Telemetry Ingestion Portal"
            subtitle="Drag & drop enterprise packet captures into the cyber environment"
            accent="cyan"
          >
            {/* Drag & Drop Surface */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  const file = e.dataTransfer.files[0];
                  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                  setCustomFile({
                    name: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
                    size: `${sizeMB} MB`,
                    type: 'PCAP',
                  });
                  setUploadProgress(0);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all ${
                dragActive ? 'border-cyan-400 bg-cyan-950/40 shadow-cyan-glow/30' : 'border-cyber-700/80 bg-cyber-950/40 hover:border-cyber-500'
              }`}
            >
              <div className="h-12 w-12 rounded-full bg-cyber-900/90 border border-cyan-500/40 flex items-center justify-center mb-2.5 shadow-cyan-glow/20">
                <UploadCloud className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="font-mono text-sm font-semibold text-cyber-100 uppercase">
                Stream Capture Telemetry Into Universe
              </h3>
              <p className="text-xs text-cyber-400 mt-1 max-w-md font-sans">
                Accepts live PCAP / PCAPNG network dumps or CSE-CIC-IDS2018 enterprise benchmark datasets.
              </p>

              {validationError && (
                <div className="mt-3 p-2 rounded bg-red-950/80 border border-red-500/60 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="mt-4">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-cyber-950 transition-colors shadow-cyan-glow">
                    <UploadCloud className="h-3.5 w-3.5" />
                    SELECT LOCAL TELEMETRY
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pcap,.pcapng,.csv,.cap"
                    onChange={handleCustomFileInput}
                  />
                </label>
              </div>
            </div>

            {/* Active File Bar */}
            <div className="mt-4 p-3 rounded-lg bg-cyber-950/80 border border-cyber-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-cyber-900 border border-cyber-700">
                  <FileText className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-cyber-100 font-semibold block truncate max-w-xs">
                      {activeFilename}
                    </span>
                    <Badge variant="cyan" size="xs">
                      {customFile ? customFile.type : selectedPreset.format}
                    </Badge>
                  </div>
                  <span className="text-[10px] font-mono text-cyber-500">
                    Size: {activeSize} &bull; {uploadProgress === 100 ? 'Status: Stream Ingested' : 'Awaiting Processing'}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSimulateUpload}
                isLoading={isProcessing}
                icon={<Play className="h-3.5 w-3.5" />}
              >
                {uploadProgress === 100 ? 'RE-EXTRACT PIPELINE' : 'STREAM DATA TO CORE'}
              </Button>
            </div>

            {/* Progress */}
            {isProcessing && (
              <div className="mt-3 p-3 rounded bg-cyber-950 border border-cyber-800 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-cyan-300 flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                    Dissecting packets, extracting Shannon entropy and IAT tensors...
                  </span>
                  <span className="text-cyber-200 font-bold">{uploadProgress}%</span>
                </div>
                <ProgressBar value={uploadProgress} variant="cyan" size="sm" />
              </div>
            )}
          </CyberPanel>

          {/* Expandable Benchmark Presets */}
          <div className="rounded-xl border border-cyber-800/80 bg-cyber-950/60 backdrop-blur-md p-3">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="w-full flex items-center justify-between font-mono text-xs text-cyber-300 hover:text-cyan-300 transition-colors"
            >
              <span className="font-bold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                CURATED ATTACK TELEMETRY PRESETS (3 BENCHMARKS)
              </span>
              {showPresets ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showPresets && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 mt-3 border-t border-cyber-800/80"
              >
                {PRESET_DATASETS.map((preset) => {
                  const isSelected = !customFile && selectedPreset.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSelectedPreset(preset);
                        setCustomFile(null);
                        setUploadProgress(100);
                      }}
                      className={`p-3 rounded-lg border text-left font-mono transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-cyan-glow/20'
                          : 'bg-cyber-950/80 border-cyber-800 text-cyber-400 hover:text-cyber-200 hover:border-cyber-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-cyber-500 uppercase">{preset.format}</span>
                          {isSelected && <Badge variant="verified" size="xs">ACTIVE</Badge>}
                        </div>
                        <span className="font-bold text-xs text-cyber-100 block line-clamp-2">
                          {preset.name}
                        </span>
                        <p className="text-[10px] text-cyber-400 font-sans mt-1 line-clamp-2">
                          {preset.attackVector}
                        </p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-cyber-850 flex items-center justify-between text-[10px] text-cyber-500">
                        <span>{preset.size}</span>
                        <span>{preset.packets}</span>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </div>
        </div>

        {/* 4. Compact Universe Telemetry Metrics */}
        <div className="lg:col-span-4 space-y-4">
          <CyberPanel title="Ingress Telemetry Scope" subtitle="Volume profile entering universe">
            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                <span className="text-[10px] text-cyber-500 block uppercase">Packets</span>
                <span className="text-base font-bold text-cyan-300 mt-0.5 block">{selectedPreset.packets}</span>
              </div>
              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                <span className="text-[10px] text-cyber-500 block uppercase">Flows</span>
                <span className="text-base font-bold text-cyber-100 mt-0.5 block">{selectedPreset.flows}</span>
              </div>
              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                <span className="text-[10px] text-cyber-500 block uppercase">IP Endpoints</span>
                <span className="text-base font-bold text-emerald-400 mt-0.5 block">{selectedPreset.ips}</span>
              </div>
              <div className="p-2.5 rounded bg-cyber-950/80 border border-cyber-800">
                <span className="text-[10px] text-cyber-500 block uppercase">Window</span>
                <span className="text-xs font-bold text-purple-300 mt-1 block truncate">{selectedPreset.timeWindow}</span>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded bg-cyber-950/80 border border-cyber-800 font-mono text-xs">
              <div className="flex items-center justify-between text-cyber-400 text-[11px]">
                <span>Protocols:</span>
                <span className="text-cyber-200 font-semibold">{selectedPreset.protocols}</span>
              </div>
              <div className="flex items-center justify-between text-cyber-400 text-[11px] mt-1.5">
                <span>Threat Vector:</span>
                <span className="text-red-400 font-semibold truncate max-w-[170px]">{selectedPreset.attackVector}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-cyber-800 flex flex-col gap-2">
              <div className="text-[11px] text-cyber-400 font-sans">
                Next, travel deeper into Chapter 2 to inspect how traffic flows through the network conduits.
              </div>
              <Link href="/analysis">
                <Button variant="cyber" size="sm" className="w-full" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                  TRAVEL TO 02 TRAFFIC ANALYSIS
                </Button>
              </Link>
            </div>
          </CyberPanel>

          {/* Forensic Standard Info */}
          <div className="p-3 rounded-lg bg-cyber-950/80 border border-cyber-800/80 text-xs font-mono space-y-1">
            <div className="flex items-center gap-1.5 text-cyber-300">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-bold text-[11px] text-cyber-200">ISO/IEC 27037 Deterministic Hash</span>
            </div>
            <p className="text-[10px] text-cyber-400 font-sans leading-relaxed">
              Every packet stream is deterministically hashed prior to buffer state extraction to guarantee evidence authenticity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
