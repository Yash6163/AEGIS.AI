import React, { useState } from 'react';
import { Copy, Check, Terminal as TerminalIcon } from 'lucide-react';

export interface TerminalBoxProps {
  title?: string;
  lines: string[];
  maxHeight?: string;
  copyText?: string;
  className?: string;
  statusBadge?: string;
}

export const TerminalBox: React.FC<TerminalBoxProps> = ({
  title = 'AUDIT LOG / BLOCKCHAIN STREAM',
  lines,
  maxHeight = 'max-h-48',
  copyText,
  className = '',
  statusBadge = 'LIVE',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = copyText || lines.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-lg bg-cyber-950 border border-cyber-700/80 font-mono text-xs overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-cyber-900 border-b border-cyber-800 text-cyber-400">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-cyber-300">
            {title}
          </span>
          {statusBadge && (
            <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 text-[9px] border border-cyan-500/30">
              {statusBadge}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] hover:text-cyan-300 transition-colors py-0.5 px-1.5 rounded hover:bg-cyber-800"
          title="Copy contents"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">COPIED</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>COPY</span>
            </>
          )}
        </button>
      </div>

      <div className={`p-3 overflow-y-auto space-y-1 select-text ${maxHeight} text-cyber-300 font-mono`}>
        {lines.map((line, idx) => (
          <div key={idx} className="leading-relaxed hover:bg-cyber-900/40 px-1 rounded flex items-start gap-2">
            <span className="text-cyber-600 select-none text-[10px] w-6 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
            <span className="break-all">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
