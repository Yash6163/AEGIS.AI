import React from 'react';

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  variant?: 'cyan' | 'red' | 'amber' | 'emerald' | 'gradient';
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  variant = 'cyan',
  size = 'sm',
  showLabel = false,
  label,
  className = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeHeights = {
    xs: 'h-1',
    sm: 'h-2',
    md: 'h-3',
  }[size];

  const variantColors = {
    cyan: 'bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.4)]',
    red: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
    amber: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
    emerald: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
    gradient: 'bg-gradient-to-r from-cyan-500 via-amber-400 to-red-500',
  }[variant];

  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center text-xs font-mono mb-1 text-cyber-300">
          <span>{label}</span>
          <span>{percentage.toFixed(1)}%</span>
        </div>
      )}
      <div className={`w-full bg-cyber-950 rounded-full overflow-hidden border border-cyber-700/60 ${sizeHeights}`}>
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${variantColors}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
