"use client";

import clsx from "clsx";
import { Activity, Bell, BrainCircuit, Gauge, LineChart, ServerCog, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { ToastProvider, useApi } from "./ui";

const NAV = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/forecast", label: "Forecast console", icon: LineChart },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/analysis", label: "Traffic analysis", icon: Upload },
  { href: "/model", label: "Model & evaluation", icon: BrainCircuit },
  { href: "/system", label: "System & audit", icon: ServerCog },
];

type Ready = { status: string; model_version: string | null; checks: Record<string, unknown> };

function StatusDot() {
  const { data, error } = useApi<Ready>("/ready");
  const ok = data?.status === "ready" && !error;
  return (
    <div className="flex items-center gap-2 text-xs text-ink-3" title={ok ? "backend ready" : "backend not ready"}>
      <span className={clsx("h-2 w-2 rounded-full", ok ? "bg-status-good" : error ? "bg-status-critical" : "bg-status-warning")} aria-hidden />
      <span>{ok ? `model ${data?.model_version}` : error ? "backend unreachable" : "connecting..."}</span>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface-0 md:flex">
          <div className="flex items-center gap-2 px-4 py-4">
            <Activity className="h-5 w-5 text-accent" aria-hidden />
            <div>
              <div className="text-sm font-semibold tracking-wide text-ink-1">AEGIS</div>
              <div className="text-[10px] uppercase tracking-wider text-ink-3">Attack-stage forecasting</div>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 px-2" aria-label="Main">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={clsx("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
                    active ? "bg-surface-2 text-ink-1" : "text-ink-3 hover:bg-surface-1 hover:text-ink-1")}
                  aria-current={active ? "page" : undefined}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line px-4 py-3"><StatusDot /></div>
        </aside>
        <div className="min-w-0 flex-1">
          <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface-0 px-3 py-2 md:hidden" aria-label="Main mobile">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href} className={clsx("whitespace-nowrap rounded px-2 py-1 text-xs", path === href ? "bg-surface-2 text-ink-1" : "text-ink-3")}>{label}</Link>
            ))}
          </nav>
          <main className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-ink-1">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-3">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
