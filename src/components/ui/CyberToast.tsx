'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, Info, X, CheckCircle2 } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'info' | 'critical';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type?: ToastType;
}

interface ToastContextValue {
  showToast: (title: string, message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useCyberToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    return {
      showToast: (title: string, message: string) => {
        console.log(`[SOC-ACTION] ${title}: ${message}`);
      },
    };
  }
  return ctx;
};

export const CyberToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((title: string, message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { id, title, message, type };
    setToasts((prev) => [...prev.slice(-3), newToast]); // keep max 4 toasts

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
        {toasts.map((toast) => {
          const isCrit = toast.type === 'critical';
          const isWarn = toast.type === 'warning';
          const isInfo = toast.type === 'info';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-lg border shadow-2xl backdrop-blur-md transition-all animate-fade-in font-mono text-xs flex items-start justify-between gap-3 ${
                isCrit
                  ? 'bg-red-950/95 border-red-500/80 text-red-200 shadow-red-glow/30'
                  : isWarn
                  ? 'bg-amber-950/95 border-amber-500/80 text-amber-200 shadow-amber-glow/30'
                  : isInfo
                  ? 'bg-cyan-950/95 border-cyan-500/80 text-cyan-200 shadow-cyan-glow/30'
                  : 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200 shadow-cyan-glow/20'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {isCrit ? (
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                ) : isWarn ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                ) : isInfo ? (
                  <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5 min-w-0">
                  <span className="font-bold uppercase tracking-wider block truncate text-[11px]">
                    {toast.title}
                  </span>
                  <p className="text-[11px] font-sans opacity-90 leading-relaxed break-words">
                    {toast.message}
                  </p>
                </div>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-white/10 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
