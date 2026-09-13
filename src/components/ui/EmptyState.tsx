import React from 'react';
import { ShieldAlert, Plus } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'NO ACTIVE ANOMALIES RECORDED',
  description = 'Network telemetry is currently quiescent or no PCAP/CSV captures have been ingested in this observation window.',
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-10 text-center rounded-lg bg-cyber-900/40 border border-dashed border-cyber-700/80 ${className}`}
    >
      <div className="h-12 w-12 rounded-full bg-cyber-800 flex items-center justify-center mb-3 text-cyber-400 border border-cyber-700">
        <ShieldAlert className="h-6 w-6 text-cyber-400" />
      </div>

      <h4 className="font-mono text-xs tracking-wider uppercase text-cyber-200 font-semibold">
        {title}
      </h4>

      <p className="mt-1 text-xs text-cyber-400 max-w-sm font-sans">
        {description}
      </p>

      {actionLabel && onAction && (
        <div className="mt-4">
          <Button
            variant="cyber"
            size="sm"
            onClick={onAction}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
