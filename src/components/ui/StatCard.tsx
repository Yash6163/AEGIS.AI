import React from 'react';
import { ThreatSeverity } from '@/types/common';

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: {
    value: string;
    isPositive: boolean; // positive change usually green, or red if threat-related
    threatInverted?: boolean; // if true, positive value means danger/red
  };
  icon?: React.ReactNode;
  statusColor?: ThreatSeverity | 'cyan' | 'neutral';
  subtext?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  delta,
  icon,
  statusColor = 'neutral',
  subtext,
  className = '',
}) => {
  const glowBorder = {
    critical: 'border-l-4 border-l-red-500 shadow-red-glow/20',
    high: 'border-l-4 border-l-amber-500 shadow-amber-glow/20',
    medium: 'border-l-4 border-l-yellow-500',
    low: 'border-l-4 border-l-emerald-500',
    cyan: 'border-l-4 border-l-cyan-400 shadow-cyan-glow/20',
    neutral: 'border-l-2 border-l-cyber-600',
  }[statusColor];

  return (
    <div
      className={`relative rounded-lg bg-cyber-900/80 border border-cyber-700/60 p-4 shadow-panel-edge backdrop-blur-sm ${glowBorder} ${className}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-cyber-400 font-medium">
          {label}
        </span>
        {icon && <div className="text-cyber-400 shrink-0">{icon}</div>}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono tracking-tight text-cyber-100">
          {value}
        </span>
        {unit && <span className="text-xs font-mono text-cyber-400">{unit}</span>}
      </div>

      {(delta || subtext) && (
        <div className="mt-2 flex items-center gap-2 text-xs font-mono">
          {delta && (
            <span
              className={`font-semibold flex items-center ${
                delta.threatInverted
                  ? delta.isPositive
                    ? 'text-red-400'
                    : 'text-emerald-400'
                  : delta.isPositive
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {delta.isPositive ? '▲' : '▼'} {delta.value}
            </span>
          )}
          {subtext && <span className="text-cyber-500 truncate">{subtext}</span>}
        </div>
      )}
    </div>
  );
};
