'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Cpu,
  Radio,
  Clock,
  ShieldCheck,
  RefreshCw,
  Terminal,
  Database,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { NotificationCenter } from './NotificationCenter';
import { DemoModeModal } from './DemoModeModal';

export const TopNav: React.FC = () => {
  const pathname = usePathname();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Format breadcrumb from pathname
  const routeName =
    pathname === '/'
      ? 'DASHBOARD'
      : pathname.replace('/', '').toUpperCase().replace('-', ' ');

  const handleSimulateCycle = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  return (
    <>
      <header className="h-16 px-6 bg-cyber-950/80 backdrop-blur-md border-b border-cyber-700/70 flex items-center justify-between sticky top-0 z-20 select-none">
        {/* Left: Breadcrumbs & Telemetry Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-xs text-cyber-400">
            <span className="text-cyber-500">SOC-OPS</span>
            <span className="text-cyber-600">/</span>
            <span className="text-cyan-400 font-semibold tracking-wider">
              {routeName}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-3 pl-4 border-l border-cyber-800 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-cyber-300">
              <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span className="text-cyber-500">INGEST:</span>
              <span className="text-cyber-200 font-semibold">24.5k pps</span>
            </div>
            <div className="flex items-center gap-1.5 text-cyber-300">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-cyber-500">ENGINE:</span>
              <span className="text-emerald-400 font-semibold">ONLINE</span>
            </div>
            <div className="flex items-center gap-1.5 text-cyber-300">
              <Clock className="h-3.5 w-3.5 text-cyber-400" />
              <span className="text-cyber-500">LATENCY:</span>
              <span className="text-cyan-300 font-semibold">38ms</span>
            </div>
          </div>
        </div>

        {/* Right: Mode Badge & Quick Actions */}
        <div className="flex items-center gap-3">
          {/* Mock / Live Service Indicator */}
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            title="Click to view Architecture & Demo Mode details"
          >
            <Badge variant="mock" size="xs">
              DEMO MODE // MOCK SERVICE LAYER
            </Badge>
          </button>

          <Button
            variant="outline"
            size="xs"
            onClick={handleSimulateCycle}
            isLoading={isRefreshing}
            icon={<RefreshCw className="h-3 w-3" />}
            title="Trigger state recalculation cycle"
          >
            REFRESH STATE
          </Button>

          {/* Notifications Button */}
          <button
            onClick={() => setIsNotifOpen(true)}
            className="relative p-2 rounded-md bg-cyber-900 hover:bg-cyber-800 text-cyber-300 hover:text-cyan-300 border border-cyber-700 transition-colors"
            title="Open SOC Alerts"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          </button>
        </div>
      </header>

      {/* Notification Slideout */}
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

      {/* Architecture & Demo Mode Modal */}
      <DemoModeModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </>
  );
};
