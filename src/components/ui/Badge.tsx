import React from 'react';
import { ThreatSeverity } from '@/types/common';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: ThreatSeverity | 'info' | 'cyber' | 'neutral' | 'mock' | 'live' | 'verified' | 'cyan';
  size?: 'xs' | 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  pulse = false,
  className = '',
}) => {
  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-semibold',
  }[size];

  const variantStyles = {
    critical: 'bg-red-950/80 text-red-400 border border-red-500/50 shadow-red-glow',
    high: 'bg-amber-950/80 text-amber-400 border border-amber-500/50 shadow-amber-glow',
    medium: 'bg-yellow-950/60 text-yellow-300 border border-yellow-500/40',
    low: 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40',
    info: 'bg-sky-950/70 text-sky-400 border border-sky-500/40',
    cyber: 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/50 shadow-cyan-glow',
    cyan: 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/50 shadow-cyan-glow',
    neutral: 'bg-cyber-800 text-cyber-300 border border-cyber-700',
    mock: 'bg-purple-950/70 text-purple-300 border border-purple-500/40',
    live: 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/60',
    verified: 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/60',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-mono uppercase tracking-wider ${sizeStyles} ${variantStyles} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span>
        </span>
      )}
      {children}
    </span>
  );
};
