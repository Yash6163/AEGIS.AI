'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UploadCloud,
  Activity,
  LineChart,
  GitCommit,
  FileCode2,
  Database,
  Globe2,
  Layers,
  Sliders,
  Shield,
  ChevronRight,
  Crosshair,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../ui/Badge';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'UNDERSTAND',
    items: [
      { name: 'SOC Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Dataset Ingestion', href: '/upload', icon: UploadCloud, badge: 'PCAP' },
      { name: 'Traffic Analysis', href: '/analysis', icon: Activity, badge: 'FLOWS' },
    ],
  },
  {
    title: 'PREDICT',
    items: [
      { name: 'Future Forecast', href: '/forecast', icon: LineChart, badge: 'K-STEP' },
      { name: 'Attack Path Graph', href: '/attack-path', icon: GitCommit, badge: 'MITRE' },
      { name: 'Model Explainability', href: '/explainability', icon: FileCode2, badge: 'SHAP' },
    ],
  },
  {
    title: 'TRUST',
    items: [
      { name: 'Blockchain Proofs', href: '/blockchain', icon: Database, badge: 'SEALED' },
      { name: 'Threat Intelligence', href: '/threat-intelligence', icon: Globe2, badge: 'STIX' },
    ],
  },
  {
    title: 'COMPARE',
    items: [
      { name: 'Competitor Matrix', href: '/competitors', icon: Layers, badge: 'USP' },
    ],
  },
  {
    title: 'CONFIGURE',
    items: [
      { name: 'Engine Settings', href: '/settings', icon: Sliders },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-[#060a10]/85 backdrop-blur-xl border-r border-cyber-700/50 flex flex-col h-screen sticky top-0 select-none z-30 shadow-2xl">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-cyber-800/80 bg-cyber-950/40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center shadow-cyan-glow">
            <Shield className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-bold tracking-wider text-cyber-100">
                AEGIS<span className="text-cyan-400">.AI</span>
              </span>
              <span className="text-[9px] font-mono px-1 py-0.2 bg-cyan-950/80 text-cyan-300 rounded border border-cyan-500/30">
                SOC
              </span>
            </div>
            <p className="text-[10px] font-mono text-cyber-400 tracking-tight">
              PREDICTIVE DEFENCE
            </p>
          </div>
        </div>

        <Link
          href="/"
          title="Open 3D Universe"
          className="p-1.5 rounded-md text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/70 border border-cyan-500/30 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
        </Link>
      </div>

      {/* Threat Posture Status Widget */}
      <div className="p-2.5 mx-3 my-2.5 rounded-lg bg-cyber-950/60 backdrop-blur-md border border-cyber-800/80">
        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
          <span className="text-cyber-400 flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-red-400 animate-pulse" />
            THREAT LEVEL
          </span>
          <Badge variant="high" size="xs" pulse>
            ELEVATED
          </Badge>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-cyber-400">
          <span>Simulation Horizon:</span>
          <span className="text-cyan-300 font-semibold">T+30m (K=5)</span>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto py-2">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-2.5 text-[9px] font-mono uppercase tracking-widest text-cyber-500 font-bold">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href === '/upload' && pathname === '/analysis');
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded font-mono text-xs transition-all duration-150 ${
                      isActive
                        ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-cyan-glow/30 font-semibold'
                        : 'text-cyber-400 hover:text-cyber-200 hover:bg-cyber-900/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                          isActive ? 'text-cyan-400' : 'text-cyber-500 group-hover:text-cyber-300'
                        }`}
                      />
                      <span className="truncate text-[11.5px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.badge && (
                        <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-cyber-950 text-cyan-400/80 border border-cyber-800">
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="h-3 w-3 text-cyan-400 shrink-0" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Node Status Footer */}
      <div className="p-3 border-t border-cyber-800/80 bg-cyber-950/50 backdrop-blur-md text-[10px] font-mono space-y-1 text-cyber-400">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Crosshair className="h-3 w-3 text-cyan-400" />
            NODE CLUSTER
          </span>
          <span className="text-cyber-300">IND-WEST-01</span>
        </div>
        <div className="flex items-center justify-between">
          <span>CONSENSUS</span>
          <span className="text-emerald-400 font-semibold">BESU-SYNCED</span>
        </div>
        <div className="text-[9px] text-cyber-600 pt-1 text-center">
          ISO/IEC 27037 FORENSIC SEAL
        </div>
      </div>
    </aside>
  );
};
