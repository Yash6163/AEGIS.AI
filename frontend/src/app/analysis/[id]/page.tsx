"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { ForecastDetail } from "@/components/ForecastDetail";
import { LineChart, StateLegend, StateStrip } from "@/components/charts/charts";
import { Card, ErrorState, Pill, Segmented, Skeleton, Stat, useApi } from "@/components/ui";
import type { Forecast, HostSummary, Job, NetworkSummary, StateName } from "@/lib/api";
import { compact, fmtDateTime, fmtTime } from "@/lib/states";

type Timeline = {
  hosts: string[];
  minutes: { window_start: string; network: NetworkSummary; hosts: (HostSummary & { label_state: StateName | null; flows: number })[] }[];
};

export default function JobPage({ params }: { params: { id: string } }) {
  const job = useApi<Job>(`/analysis/jobs/${params.id}`);
  const tl = useApi<Timeline>(job.data?.status === "completed" ? `/analysis/jobs/${params.id}/timeline` : null, [job.data?.status]);
  const [pick, setPick] = useState<{ host: string; minute: number } | null>(null);
  const [horizon, setHorizon] = useState(5);
  const fc = useApi<Forecast>(pick ? `/analysis/jobs/${params.id}/forecast?host=${encodeURIComponent(pick.host)}&minute=${pick.minute}&horizon=${horizon}` : null);

  const rows = useMemo(() => {
    if (!tl.data) return [];
    const idx = new Map(tl.data.minutes.map((m, i) => [m.window_start, i]));
    const out: { label: string; states: (StateName | null)[] }[] = [];
    for (const h of tl.data.hosts) {
      const pred: (StateName | null)[] = Array(tl.data.minutes.length).fill(null);
      const lab: (StateName | null)[] = Array(tl.data.minutes.length).fill(null);
      tl.data.minutes.forEach((m) => {
        const r = m.hosts.find((x) => x.host === h);
        if (r) { pred[idx.get(m.window_start)!] = r.current_state; lab[idx.get(m.window_start)!] = r.label_state; }
      });
      out.push({ label: h, states: pred });
      if (job.data?.has_labels) out.push({ label: "  label", states: lab });
    }
    return out;
  }, [tl.data, job.data?.has_labels]);

  const j = job.data;
  return (
    <div className="space-y-4">
      <PageHeader title={j ? j.filename : "Analysis"} description={<Link href="/analysis" className="text-accent hover:underline">← all analyses</Link>}>
        {j && <Pill>{j.status}</Pill>}
        {j?.anonymized && <Pill tone="info">host IPs pseudonymised</Pill>}
      </PageHeader>
      {job.error && <ErrorState error={job.error} />}
      {j && (
        <Card>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Stat label="Flows" value={j.n_flows ? compact(j.n_flows) : "-"} />
            <Stat label="Hosts" value={j.n_hosts ?? "-"} />
            <Stat label="Minutes" value={j.n_windows ?? "-"} />
            <Stat label="Span" value={<span className="text-sm">{fmtDateTime(j.start_time)}</span>} hint={`to ${fmtTime(j.end_time)}`} />
            <Stat label="Model" value={<span className="text-sm">{j.model_version ?? "-"}</span>} />
          </div>
          {j.warnings.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-status-warning">{j.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </Card>
      )}
      {tl.error && <ErrorState error={tl.error} />}
      {j?.status === "completed" && (!tl.data ? <Skeleton className="h-64" /> : (
        <>
          <Card title="Network risk over time" subtitle="Highest host risk score each minute (policy score, 0-100) and maximum forecast P(attack within 5 min).">
            <LineChart xLabels={tl.data.minutes.map((m) => fmtTime(m.window_start).slice(0, 5))} yMax={1} yFormat={(v) => `${Math.round(v * 100)}`}
              series={[
                { name: "max risk score / 100", color: "#ec835a", values: tl.data.minutes.map((m) => m.network.risk_score / 100) },
                { name: "max P(attack within 5 min)", color: "#3987e5", values: tl.data.minutes.map((m) => m.network.max_attack_probability), dashed: true },
              ]} />
            <div className="mt-1 flex gap-4 text-[11px] text-ink-2">
              <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-[#ec835a]" /> max risk score / 100</span>
              <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 border-t-2 border-dashed border-[#3987e5]" /> max P(attack within 5 min)</span>
            </div>
          </Card>
          <Card title="Inferred state per host" subtitle={`Model nowcast per minute${j.has_labels ? "; the row under each host shows the file's labels" : ""}. Click a cell to open that host's forecast.`}>
            <StateStrip rows={rows} height={10} labelWidth={150}
              onPick={(t, r) => setPick({ host: rows[r].label.trim() === "label" ? rows[r - 1].label : rows[r].label, minute: t })} />
            <div className="mt-2"><StateLegend states={["RECONNAISSANCE", "CREDENTIAL_ACCESS", "EXPLOITATION", "COMMAND_AND_CONTROL", "INFILTRATION", "IMPACT"]} /></div>
          </Card>
          {pick && (
            <Card title={<span>Forecast for <span className="font-mono">{pick.host}</span> at minute {pick.minute}</span>}
              action={<Segmented label="Horizon" value={horizon} onChange={setHorizon} options={[1, 3, 5, 10].map((v) => ({ value: v, label: `K=${v}` }))} />}>
              {fc.error ? <ErrorState error={fc.error} /> : !fc.data ? <Skeleton className="h-80" /> : <ForecastDetail fc={fc.data} />}
            </Card>
          )}
        </>
      ))}
    </div>
  );
}
