import React from 'react';
import { Radar, Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  label?: string;
  subtext?: string;
  variant?: 'radar' | 'spinner' | 'skeleton';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'ACQUIRING TELEMETRY STREAM...',
  subtext = 'Computing graph neural embeddings & temporal state transitions',
  variant = 'radar',
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center rounded-lg bg-cyber-900/50 border border-cyber-800/80 backdrop-blur-sm ${className}`}
    >
      {variant === 'radar' ? (
        <div className="relative flex items-center justify-center mb-4">
          <div className="h-16 w-16 rounded-full border border-cyan-500/30 animate-ping absolute" />
          <div className="h-12 w-12 rounded-full border border-cyan-400/50 flex items-center justify-center bg-cyan-950/40">
            <Radar className="h-6 w-6 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
        </div>
      ) : (
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mb-4" />
      )}

      <span className="font-mono text-sm tracking-wider uppercase text-cyan-300 font-semibold">
        {label}
      </span>
      {subtext && (
        <p className="mt-1 text-xs text-cyber-400 font-sans max-w-sm">
          {subtext}
        </p>
      )}
    </div>
  );
};
