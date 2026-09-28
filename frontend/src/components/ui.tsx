"use client";

import clsx from "clsx";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert } from "lucide-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { RiskLevel, StateName } from "@/lib/api";
import { ApiError, api } from "@/lib/api";
import { RISK_COLOR, STATE_COLOR, STATE_LABEL } from "@/lib/states";

export function Card({ title, subtitle, action, children, className, bodyClass }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode;
  children: React.ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={clsx("rounded-lg border border-line bg-surface-1", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink-1">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={clsx("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-1 truncate text-2xl font-semibold tabular-nums text-ink-1" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

const RISK_ICON: Record<RiskLevel, React.ElementType> = {
  LOW: CheckCircle2, MEDIUM: AlertTriangle, HIGH: ShieldAlert, CRITICAL: AlertOctagon,
};

export function RiskBadge({ level, score, size = "sm" }: { level: RiskLevel; score?: number; size?: "sm" | "md" }) {
  const Icon = RISK_ICON[level];
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded border font-semibold", size === "md" ? "px-2 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]")}
      style={{ color: RISK_COLOR[level], borderColor: RISK_COLOR[level] + "66", background: RISK_COLOR[level] + "14" }}
    >
      <Icon className={size === "md" ? "h-4 w-4" : "h-3 w-3"} aria-hidden />
      {level}
      {score !== undefined && <span className="font-normal tabular-nums text-ink-2">{score.toFixed(0)}</span>}
    </span>
  );
}

export function StateChip({ state, prob, muted }: { state: StateName | "OTHER"; prob?: number; muted?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", muted ? "text-ink-3" : "text-ink-1")}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STATE_COLOR[state] }} aria-hidden />
      {STATE_LABEL[state]}
      {prob !== undefined && <span className="tabular-nums text-ink-3">{(prob * 100).toFixed(0)}%</span>}
    </span>
  );
}

export function Pill({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: "neutral" | "info" | "warn"; title?: string }) {
  const cls = {
    neutral: "border-line-strong text-ink-2",
    info: "border-accent/50 text-accent bg-accent/10",
    warn: "border-status-warning/50 text-status-warning bg-status-warning/10",
  }[tone];
  return <span title={title} className={clsx("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium", cls)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded bg-surface-3", className)} aria-hidden />;
}

export function EmptyState({ title, children, icon: Icon = Info }: { title: string; children?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Icon className="h-6 w-6 text-ink-3" aria-hidden />
      <div className="text-sm font-medium text-ink-2">{title}</div>
      {children && <div className="max-w-md text-xs text-ink-3">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error);
  const rid = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-sm">
      <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-ink-1">{msg}</div>
        {rid && <div className="mt-0.5 font-mono text-[11px] text-ink-3">request {rid}</div>}
      </div>
      {onRetry && <Button variant="ghost" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Button({ variant = "default", className, busy, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost"; busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-white hover:bg-[#2a78d6]",
        variant === "default" && "border border-line-strong bg-surface-2 text-ink-1 hover:bg-surface-3",
        variant === "ghost" && "text-ink-2 hover:bg-surface-3 hover:text-ink-1",
        className,
      )}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx("rounded px-2.5 py-1 text-xs font-medium tabular-nums", o.value === value ? "bg-surface-3 text-ink-1" : "text-ink-3 hover:text-ink-1")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Fetch hook with loading / error / refresh; `path=null` skips fetching. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    api<T>(path)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, refresh };
}

// --- toasts ---------------------------------------------------------------
type Toast = { id: number; text: string; tone: "info" | "error" | "alert" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={clsx("pointer-events-auto rounded-md border bg-surface-2 px-3 py-2 text-sm shadow-lg",
            t.tone === "error" ? "border-status-critical/60" : t.tone === "alert" ? "border-status-serious/60" : "border-line-strong")}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
