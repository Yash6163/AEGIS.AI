import React, { useState } from 'react';
import { X, Bell, ShieldAlert, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { NotificationItem } from '@/types/common';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const initialNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Future Attack Escalation Predicted',
    message: 'Model predicts transition to Initial Access (T1190) in T+5 minutes with 88% probability.',
    severity: 'critical',
    timestamp: '2 mins ago',
    read: false,
    category: 'prediction',
    targetIp: '10.240.12.4',
  },
  {
    id: 'notif-2',
    title: 'Blockchain Proof Anchored',
    message: 'Prediction hash 0x8f3c7...9a1 verified on Block #4892184.',
    severity: 'low',
    timestamp: '5 mins ago',
    read: false,
    category: 'blockchain',
  },
  {
    id: 'notif-3',
    title: 'SYN Flood Anomaly Detected',
    message: 'SYN rate surged to 482 pkts/sec on gateway 10.240.10.1.',
    severity: 'high',
    timestamp: '12 mins ago',
    read: true,
    category: 'network',
    sourceIp: '198.51.100.188',
  },
  {
    id: 'notif-4',
    title: 'STIX Threat Indicator Match',
    message: 'Peer CERT-IN Node flagged IP 198.51.100.188 as active APT-29 staging node.',
    severity: 'high',
    timestamp: '25 mins ago',
    read: true,
    category: 'mitre',
  },
];

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-cyber-900/95 backdrop-blur-xl border-l border-cyber-700 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-cyber-800 bg-cyber-950/60">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-cyan-400" />
          <h2 className="font-mono text-sm font-semibold tracking-wider uppercase text-cyber-100">
            SOC Alert Feed
          </h2>
          <Badge variant="cyber" size="xs">
            {notifications.filter((n) => !n.read).length} NEW
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            className="text-[11px] font-mono text-cyber-400 hover:text-cyan-300 transition-colors"
          >
            Mark All Read
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-cyber-400 hover:text-cyber-100 hover:bg-cyber-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 px-5 py-2.5 bg-cyber-850/40 border-b border-cyber-800 text-xs font-mono">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded transition-colors ${
            filter === 'all'
              ? 'bg-cyber-800 text-cyan-300 font-semibold border border-cyber-700'
              : 'text-cyber-400 hover:text-cyber-200'
          }`}
        >
          All Alerts ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-2.5 py-1 rounded transition-colors ${
            filter === 'unread'
              ? 'bg-cyber-800 text-cyan-300 font-semibold border border-cyber-700'
              : 'text-cyber-400 hover:text-cyber-200'
          }`}
        >
          Unread ({notifications.filter((n) => !n.read).length})
        </button>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`p-3.5 rounded-lg border transition-all ${
              item.read
                ? 'bg-cyber-900/50 border-cyber-800 text-cyber-400'
                : 'bg-cyber-850 border-cyber-700 text-cyber-200 shadow-panel-edge'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {item.severity === 'critical' && (
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                {item.severity === 'high' && (
                  <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                )}
                {item.severity === 'low' && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                )}
                <span className="font-mono text-xs font-semibold text-cyber-100">
                  {item.title}
                </span>
              </div>
              <Badge variant={item.severity} size="xs">
                {item.severity}
              </Badge>
            </div>

            <p className="mt-1.5 text-xs text-cyber-300 font-sans leading-relaxed">
              {item.message}
            </p>

            <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-cyber-500">
              <span>{item.timestamp}</span>
              {item.targetIp && <span>Target: {item.targetIp}</span>}
              {item.sourceIp && <span>Src: {item.sourceIp}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-cyber-800 bg-cyber-950/60 text-center">
        <span className="text-[11px] font-mono text-cyber-500">
          SOC Live Dispatch Channel #01 • Auto-prunes after 48 hours
        </span>
      </div>
    </div>
  );
};
