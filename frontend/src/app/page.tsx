"use client";

import { ArrowRight, Bell, Clock, LineChart, ShieldCheck } from "lucide-react";
import Link from "next/link";
import React from "react";
import { PageHeader } from "@/components/Shell";
import { Card, EmptyState, ErrorState, RiskBadge, Skeleton, Stat, StateChip, useApi } from "@/components/ui";
import type { Alert, Job, RiskLevel, ScenarioMeta } from "@/lib/api";
import { RISK_COLOR, fmtDateTime, pct } from "@/lib/states";

type Dashboard = {
  model: { version: string | null; ready: boolean; cv_models: number };
  headline_metrics: null | {
    protocol: string; n_samples: number; macro_f1: Record<string, number>;
    early_warning: { auroc: number; auprc: number; recall_at_threshold: number; false_alarm_rate_at_threshold: number } | null;
    lead_time: { n_onsets: number; forecast_before_onset_rate: number; median_lead_minutes_when_forecast: number } | null;
  };
  alerts: { open_by_level: Partial<Record<RiskLevel, number>>; open_total: number; recent: Alert[] };
  jobs: { by_status: Record<string, number>; recent: Job[] };
  audit: { entries: number };
};

type Metrics = { forecast: Record<string, Record<string, { macro_f1: number }>>; early_warning: { models: Record<string, { auroc: number | null }> } };

export default function Overview() {
  const dash = useApi<Dashboard>("/dashboard");
  const metrics = useApi<Metrics>("/model/metrics");
  const scen = useApi<{ scenarios: ScenarioMeta[] }>("/scenarios");
  const d = dash.data;
  const m = metrics.data;
  const ew = m?.early_warning.models;
  const f5 = (name: string) => m?.forecast[name]?.["5"]?.macro_f1;

  return (
    <div className="space-y-5">
      <PageHeader title="Overview"
        description="Intrusion detection tells you which attack stage a host is in now. AEGIS forecasts which stage it is likely to reach next - a learned model of P(S[t+1] | S[t], traffic history), rolled forward K minutes." />

      {dash.error && <ErrorState error={dash.error} onRetry={dash.refresh} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Forecasting vs. baselines" subtitle={m ? "5-fold blocked cross-validation on CIC-IDS2017, out-of-fold" : undefined} className="lg:col-span-2">
          {!m ? <Skeleton className="h-28" /> : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Early-warning AUROC" value={ew?.world_model?.auroc?.toFixed(3) ?? "-"}
                hint={`XGBoost ${ew?.xgboost_direct?.auroc?.toFixed(3) ?? "-"} · Markov ${ew?.markov_nowcast?.auroc?.toFixed(3) ?? "-"}`} />
              <Stat label="Macro-F1 at +5 min" value={f5("world_model")?.toFixed(3) ?? "-"}
                hint={`XGBoost ${f5("xgboost_direct")?.toFixed(3) ?? "-"} · Markov ${f5("markov_nowcast")?.toFixed(3) ?? "-"}`} />
              <Stat label="Onsets warned in advance" value={pct(d?.headline_metrics?.lead_time?.forecast_before_onset_rate)}
                hint={d?.headline_metrics?.lead_time ? `of ${d.headline_metrics.lead_time.n_onsets} attack onsets` : undefined} />
              <Stat label="False warnings" value={pct(d?.headline_metrics?.early_warning?.false_alarm_rate_at_threshold, 1)}
                hint="of quiet host-minutes" />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link href="/model" className="inline-flex items-center gap-1 text-accent hover:underline">Full evaluation, baselines and limitations <ArrowRight className="h-3 w-3" /></Link>
          </div>
        </Card>
        <Card title="Open alerts" action={<Link href="/alerts" className="text-xs text-accent hover:underline">view all</Link>}>
          {!d ? <Skeleton className="h-28" /> : (
            <div>
              <div className="text-3xl font-semibold tabular-nums text-ink-1">{d.alerts.open_total}</div>
              <div className="mt-3 space-y-1.5">
                {(["CRITICAL", "HIGH", "MEDIUM"] as RiskLevel[]).map((l) => (
                  <div key={l} className="flex items-center justify-between text-xs">
                    <RiskBadge level={l} />
                    <span className="tabular-nums text-ink-2">{d.alerts.open_by_level[l] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Run a forecast" subtitle="Each capture day of CIC-IDS2017 can be replayed in the forecast console (recorded traffic, labelled as simulation).">
        {scen.error ? <ErrorState error={scen.error} /> : !scen.data ? <Skeleton className="h-24" /> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {scen.data.scenarios.map((s) => (
              <Link key={s.id} href={`/forecast?scenario=${s.id}`}
                className="group rounded-md border border-line bg-surface-0 p-3 hover:border-accent/60">
                <div className="flex items-center justify-between text-sm font-medium text-ink-1">{s.day[0].toUpperCase() + s.day.slice(1)}
                  <LineChart className="h-4 w-4 text-ink-3 group-hover:text-accent" aria-hidden /></div>
                <p className="mt-1 text-xs text-ink-3">{s.description}</p>
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                  {Object.entries(s.attack_minutes).filter(([, v]) => v > 0).map(([k, v]) => (
                    <span key={k} className="text-[11px] text-ink-2"><StateChip state={k as never} /> <span className="text-ink-3">{v}m</span></span>
                  ))}
                  {Object.values(s.attack_minutes).every((v) => v === 0) && <span className="text-[11px] text-ink-3">no attacks</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Recent alerts" bodyClass="p-0">
          {!d ? <div className="p-4"><Skeleton className="h-40" /></div> : d.alerts.recent.length === 0 ? (
            <EmptyState title="No alerts yet" icon={Bell}>Alerts are raised by replays in the forecast console and by uploaded traffic analyses.</EmptyState>
          ) : (
            <ul>
              {d.alerts.recent.map((a) => (
                <li key={a.id} className="flex items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RISK_COLOR[a.level] }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-ink-1">{a.title}</div>
                    <div className="text-[11px] text-ink-3">{a.source} · {fmtDateTime(a.created_at)}</div>
                  </div>
                  <RiskBadge level={a.level} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="System" action={<Link href="/system" className="text-xs text-accent hover:underline">details</Link>}>
          {!d ? <Skeleton className="h-40" /> : (
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Model" value={<span className="text-base">{d.model.version ?? "not loaded"}</span>} hint={d.model.ready ? "ready" : "not ready"} />
              <Stat label="Cross-validation models" value={d.model.cv_models} hint="used for out-of-sample replay" />
              <Stat label="Analyses" value={Object.values(d.jobs.by_status).reduce((a, b) => a + b, 0)} hint={<span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> uploads processed</span>} />
              <Stat label="Audit chain" value={d.audit.entries} hint={<span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> hash-chained entries</span>} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
