import React from 'react';

export interface CyberPanelProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accent?: 'cyan' | 'red' | 'amber' | 'emerald' | 'none';
  headerBorder?: boolean;
}

export const CyberPanel: React.FC<CyberPanelProps> = ({
  title,
  subtitle,
  badge,
  actions,
  children,
  className = '',
  accent = 'none',
  headerBorder = true,
}) => {
  const accentBorder = {
    cyan: 'border-l-2 border-l-cyan-400 shadow-[inset_0_1px_0_0_rgba(0,240,255,0.15)]',
    red: 'border-l-2 border-l-red-500 shadow-[inset_0_1px_0_0_rgba(239,68,68,0.15)]',
    amber: 'border-l-2 border-l-amber-500 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.15)]',
    emerald: 'border-l-2 border-l-emerald-500 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.15)]',
    none: '',
  }[accent];

  return (
    <div
      className={`relative rounded-xl bg-cyber-950/70 border border-cyber-700/50 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] overflow-hidden transition-all duration-200 ${accentBorder} ${className}`}
    >
      {/* Subtle top-corner cyber decorative tick */}
      <div className="absolute top-0 right-0 h-2.5 w-2.5 border-t border-r border-cyan-400/50 pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-cyan-400/50 pointer-events-none" />

      {(title || badge || actions) && (
        <div
          className={`flex items-center justify-between px-4 py-3 bg-cyber-900/50 backdrop-blur-md ${
            headerBorder ? 'border-b border-cyber-800/60' : ''
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {badge}
            <div>
              {title && (
                <h3 className="text-sm font-semibold text-cyber-100 tracking-wide uppercase font-mono flex items-center gap-2">
                  <span>{title}</span>
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-cyber-400 mt-0.5 font-sans truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      <div className="p-4 relative z-10">{children}</div>
    </div>
  );
};
