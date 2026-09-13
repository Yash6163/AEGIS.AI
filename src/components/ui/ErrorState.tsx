import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  errorCode?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'TELEMETRY INGESTION ANOMALY',
  message = 'Failed to establish duplex state link with inference engine.',
  errorCode = 'ERR_SOC_DISCONNECT_503',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg bg-red-950/20 border border-red-500/40 ${className}`}
    >
      <div className="h-12 w-12 rounded-full bg-red-950/80 border border-red-500 flex items-center justify-center mb-3 shadow-red-glow">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>

      <h4 className="font-mono text-sm tracking-wider uppercase text-red-300 font-semibold">
        {title}
      </h4>

      <p className="mt-1 text-xs text-cyber-300 max-w-md font-sans">
        {message}
      </p>

      {errorCode && (
        <span className="mt-2 text-[10px] font-mono text-red-400/80 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
          DIAGNOSTIC: {errorCode}
        </span>
      )}

      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            icon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            RE-ENGAGE LINK
          </Button>
        </div>
      )}
    </div>
  );
};
