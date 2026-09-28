"use client";

import { Bell, X } from "lucide-react";
import React, { useState } from "react";
import { PageHeader } from "@/components/Shell";
import { ForecastDetail } from "@/components/ForecastDetail";
import { Button, Card, EmptyState, ErrorState, RiskBadge, Segmented, Skeleton, StateChip, useApi, useToast } from "@/components/ui";
import { type Alert, type Forecast, api } from "@/lib/api";
import { fmtDateTime, pct } from "@/lib/states";

type Page = { total: number; items: Alert[] };
const PAGE = 25;

export default function AlertsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<"open" | "acknowledged" | "resolved" | "">("open");
  const [level, setLevel] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const q = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
  if (status) q.set("status", status);
  if (level) q.set("level", level);
  if (source) q.set("source", source);
  const list = useApi<Page>(`/alerts?${q}`);
  const detail = useApi<{ alert: Alert; forecast: Forecast | null }>(selected ? `/alerts/${selected}` : null);

  const setStatusOf = async (id: string, s: Alert["status"]) => {
    try {
      await api(`/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
      toast(`Alert ${s}`);
      list.refresh();
      detail.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "update failed", "error");
    }
  };

  return (
    <div>
      <PageHeader title="Alerts" description="Raised when a host enters the early-warning condition (forecast P(attack) above the validated threshold) or HIGH/CRITICAL risk - once per episode, not every minute. Each alert keeps the forecast that triggered it." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented label="Status" value={status} onChange={(v) => { setStatus(v); setOffset(0); }}
          options={[{ value: "open", label: "Open" }, { value: "acknowledged", label: "Acknowledged" }, { value: "resolved", label: "Resolved" }, { value: "", label: "All" }]} />
        <Segmented label="Level" value={level} onChange={(v) => { setLevel(v); setOffset(0); }}
          options={[{ value: "", label: "Any level" }, { value: "CRITICAL", label: "Critical" }, { value: "HIGH", label: "High" }, { value: "MEDIUM", label: "Medium" }]} />
        <Segmented label="Source" value={source} onChange={(v) => { setSource(v); setOffset(0); }}
          options={[{ value: "", label: "Any source" }, { value: "replay", label: "Replay" }, { value: "upload", label: "Upload" }]} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card bodyClass="p-0" title={list.data ? `${list.data.total} alerts` : "Alerts"}>
          {list.error ? <div className="p-3"><ErrorState error={list.error} onRetry={list.refresh} /></div> : list.loading && !list.data ? (
            <div className="space-y-2 p-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : list.data && list.data.items.length === 0 ? (
            <EmptyState title="No alerts match" icon={Bell}>Replay a scenario in the forecast console or upload traffic to generate alerts.</EmptyState>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead className="text-ink-3"><tr>
                  <th className="px-3 py-2 text-left font-normal">level</th><th className="py-2 text-left font-normal">host / forecast</th>
                  <th className="py-2 text-right font-normal">P(attack)</th><th className="px-3 py-2 text-right font-normal">raised</th>
                </tr></thead>
                <tbody>
                  {list.data?.items.map((a) => (
                    <tr key={a.id} onClick={() => setSelected(a.id)}
                      className={`cursor-pointer border-t border-line hover:bg-surface-2 ${selected === a.id ? "bg-surface-2" : ""}`}>
                      <td className="px-3 py-2"><RiskBadge level={a.level} score={a.risk_score} /></td>
                      <td className="py-2">
                        <div className="font-mono text-ink-1">{a.host}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-ink-3">{a.current_state === "NORMAL" ? "normal now" : "in attack"} → <StateChip state={a.predicted_state} /></div>
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink-1">{pct(a.attack_probability)}</td>
                      <td className="px-3 py-2 text-right text-ink-3">
                        <div>{fmtDateTime(a.created_at)}</div>
                        <div className="text-[10px]">{a.source}{a.status !== "open" ? ` · ${a.status}` : ""}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-ink-3">
                <span>{offset + 1}-{Math.min(offset + PAGE, list.data?.total ?? 0)} of {list.data?.total}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
                  <Button variant="ghost" disabled={offset + PAGE >= (list.data?.total ?? 0)} onClick={() => setOffset(offset + PAGE)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card title={detail.data ? "Alert evidence" : "Select an alert"}
          action={selected && <Button variant="ghost" onClick={() => setSelected(null)} aria-label="Close"><X className="h-4 w-4" /></Button>}>
          {!selected ? <EmptyState title="No alert selected">Pick an alert to see the forecast, trajectories and explanation that raised it.</EmptyState>
            : detail.error ? <ErrorState error={detail.error} /> : !detail.data ? <Skeleton className="h-80" /> : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm text-ink-1">{detail.data.alert.title}</div>
                  <div className="text-xs text-ink-3">
                    {detail.data.alert.source === "replay" ? "Replay (simulation)" : "Uploaded traffic"} · context {detail.data.alert.context} ·
                    window {fmtDateTime(detail.data.alert.window_start)} · model {detail.data.alert.model_version}
                  </div>
                  <div className="flex gap-2">
                    {detail.data.alert.status !== "acknowledged" && <Button onClick={() => setStatusOf(detail.data!.alert.id, "acknowledged")}>Acknowledge</Button>}
                    {detail.data.alert.status !== "resolved" && <Button onClick={() => setStatusOf(detail.data!.alert.id, "resolved")}>Resolve</Button>}
                    {detail.data.alert.status !== "open" && <Button variant="ghost" onClick={() => setStatusOf(detail.data!.alert.id, "open")}>Reopen</Button>}
                  </div>
                </div>
                {detail.data.forecast ? <ForecastDetail fc={detail.data.forecast} /> : <EmptyState title="Forecast evidence not stored" />}
              </div>
            )}
        </Card>
      </div>
    </div>
  );
}
