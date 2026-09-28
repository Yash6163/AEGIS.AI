"use client";

import { AlertTriangle, FlaskConical, Pause, Play, RotateCcw, StepForward } from "lucide-react";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/Shell";
import { ForecastDetail } from "@/components/ForecastDetail";
import { StateLegend, StateStrip } from "@/components/charts/charts";
import { Button, Card, EmptyState, ErrorState, Pill, RiskBadge, Segmented, Skeleton, StateChip, useApi, useToast } from "@/components/ui";
import { API_BASE, type Forecast, type ScenarioDetail, type ScenarioMeta, type Snapshot, type StateName, api } from "@/lib/api";
import { compact, fmtTime, pct } from "@/lib/states";

const HORIZONS = [1, 3, 5, 10].map((v) => ({ value: v, label: `K=${v}` }));
const SPEEDS = [{ value: 1500, label: "slow" }, { value: 700, label: "1x" }, { value: 250, label: "fast" }];

export default function ForecastPageWrapper() {
  return <Suspense fallback={<Skeleton className="h-96" />}><ForecastPage /></Suspense>;
}

function ForecastPage() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const scenarios = useApi<{ scenarios: ScenarioMeta[]; data_label: string; citation: string }>("/scenarios");
  const scenarioId = params.get("scenario") ?? "cicids2017-thursday";
  const [t, setT] = useState<number>(Number(params.get("t") ?? 25));
  const [host, setHost] = useState<string | null>(params.get("host"));
  const [horizon, setHorizon] = useState<number>(5);
  const [speed, setSpeed] = useState<number>(700);
  const [playing, setPlaying] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [snapErr, setSnapErr] = useState<unknown>(null);
  const [fc, setFc] = useState<Forecast | null>(null);
  const [fcErr, setFcErr] = useState<unknown>(null);
  const [fcLoading, setFcLoading] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<{ id: string; title: string; level: string; t: number }[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const detail = useApi<ScenarioDetail>(`/scenarios/${scenarioId}`, []);

  const selectScenario = (id: string) => {
    stop();
    setSnap(null); setFc(null); setHost(null); setT(25); setLiveAlerts([]);
    router.replace(`/forecast?scenario=${id}`);
  };

  // snapshot when paused / stepping
  const loadSnapshot = useCallback(async (tt: number) => {
    try {
      setSnap(await api<Snapshot>(`/scenarios/${scenarioId}/snapshot?t=${tt}`));
      setSnapErr(null);
    } catch (e) { setSnapErr(e); }
  }, [scenarioId]);

  useEffect(() => { if (!playing) loadSnapshot(t); }, [t, playing, loadSnapshot]);

  // pick the riskiest host automatically if none selected
  const activeHost = host ?? snap?.network.highest_risk_host ?? null;

  useEffect(() => {
    if (!activeHost) return;
    let alive = true;
    setFcLoading(true);
    api<Forecast>(`/scenarios/${scenarioId}/forecast?host=${encodeURIComponent(activeHost)}&t=${t}&horizon=${horizon}`)
      .then((d) => { if (alive) { setFc(d); setFcErr(null); } })
      .catch((e) => { if (alive) setFcErr(e); })
      .finally(() => { if (alive) setFcLoading(false); });
    return () => { alive = false; };
  }, [scenarioId, activeHost, t, horizon]);

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setPlaying(false);
  }, []);

  const start = () => {
    stop();
    const es = new EventSource(`${API_BASE}/scenarios/${scenarioId}/stream?start=${t}&interval_ms=${speed}`);
    esRef.current = es;
    setPlaying(true);
    es.addEventListener("snapshot", (ev) => {
      const s = JSON.parse((ev as MessageEvent).data) as Snapshot;
      setSnap(s);
      setT(s.t);
    });
    es.addEventListener("alert", (ev) => {
      const a = JSON.parse((ev as MessageEvent).data);
      setLiveAlerts((xs) => [{ id: a.id, title: a.title, level: a.level, t: a.t }, ...xs].slice(0, 30));
      toast(`${a.level} alert - ${a.title}`, "alert");
    });
    es.addEventListener("end", () => stop());
    es.onerror = () => { toast("Replay stream interrupted", "error"); stop(); };
  };

  useEffect(() => () => esRef.current?.close(), []);

  const meta = scenarios.data?.scenarios.find((s) => s.id === scenarioId);
  const n = meta?.n_windows ?? 0;
  const rows = useMemo(() => {
    if (!detail.data) return [];
    return detail.data.hosts.map((h, i) => ({ label: h.host, states: detail.data!.timeline.truth[i] as (StateName | null)[] }));
  }, [detail.data]);

  return (
    <div>
      <PageHeader title="Forecast console"
        description="Step through a recorded capture day minute by minute. At each minute the world model infers every host's current attack stage and rolls it forward K minutes.">
        <Segmented label="Forecast horizon" value={horizon} options={HORIZONS} onChange={setHorizon} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-status-warning/30 bg-status-warning/5 px-3 py-2 text-xs text-ink-2">
        <FlaskConical className="h-4 w-4 text-status-warning" aria-hidden />
        <span><b className="text-ink-1">Simulation / demo traffic.</b> Recorded CIC-IDS2017 flows replayed in time order - not a live network feed.
          Each minute is forecast by the cross-validation model that never saw that 30-minute block, so what you see is out-of-sample.</span>
      </div>

      {scenarios.error ? <ErrorState error={scenarios.error} onRetry={scenarios.refresh} /> : null}

      <Card className="mb-4" bodyClass="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Scenario" value={scenarioId} onChange={(e) => selectScenario(e.target.value)}
            className="rounded-md border border-line-strong bg-surface-2 px-2 py-1.5 text-sm text-ink-1">
            {scenarios.data?.scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <span className="hidden text-xs text-ink-3 lg:inline">{meta?.description}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {playing
              ? <Button onClick={stop}><Pause className="h-4 w-4" /> Pause</Button>
              : <Button variant="primary" onClick={start} disabled={!meta || t >= n - 1}><Play className="h-4 w-4" /> Start</Button>}
            <Button onClick={() => { stop(); setT((x) => Math.min(x + 1, n - 1)); }} disabled={t >= n - 1}><StepForward className="h-4 w-4" /> Next minute</Button>
            <Button variant="ghost" onClick={() => { stop(); setT(0); setLiveAlerts([]); }}><RotateCcw className="h-4 w-4" /> Reset</Button>
            <Segmented label="Replay speed" value={speed} options={SPEEDS} onChange={(v) => { setSpeed(v); if (playing) stop(); }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={Math.max(n - 1, 0)} value={t} aria-label="Minute"
            onChange={(e) => { stop(); setT(Number(e.target.value)); }} className="w-full accent-[#3987e5]" />
          <span className="w-44 shrink-0 text-right text-xs tabular-nums text-ink-2">
            minute {t} / {n - 1} · {snap ? fmtTime(snap.window_start) : "-"}
          </span>
        </div>
        {detail.data ? (
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
              <span>Ground-truth attack states per host (dataset labels). Click to jump.</span>
              <StateLegend states={["RECONNAISSANCE", "CREDENTIAL_ACCESS", "EXPLOITATION", "COMMAND_AND_CONTROL", "INFILTRATION", "IMPACT"]} />
            </div>
            <StateStrip rows={rows} cursor={t} height={10} labelWidth={110} onPick={(tt, r) => { stop(); setT(tt); setHost(rows[r].label); }} />
          </div>
        ) : <Skeleton className="h-40" />}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Hosts at this minute" subtitle={snap ? `Early warning when P(attack within ${snap.early_warning.horizon} min) >= ${pct(snap.early_warning.threshold)} (threshold chosen on validation data)` : undefined} bodyClass="p-0">
            {snapErr ? <div className="p-3"><ErrorState error={snapErr} onRetry={() => loadSnapshot(t)} /></div> : !snap ? (
              <div className="space-y-2 p-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-ink-3">
                  <tr><th className="px-3 py-2 text-left font-normal">host</th><th className="py-2 text-left font-normal">nowcast</th><th className="py-2 text-right font-normal">P(att.)</th><th className="px-3 py-2 text-right font-normal">risk</th></tr>
                </thead>
                <tbody>
                  {snap.hosts.slice().sort((a, b) => b.risk_score - a.risk_score || b.attack_probability - a.attack_probability).map((h) => (
                    <tr key={h.host} onClick={() => setHost(h.host)}
                      className={`cursor-pointer border-t border-line hover:bg-surface-2 ${h.host === activeHost ? "bg-surface-2" : ""}`}>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1 font-mono text-ink-1">{h.host}{h.warning && <AlertTriangle className="h-3 w-3 text-status-warning" aria-label="early warning" />}</div>
                        <div className="text-[10px] text-ink-3">{h.role ?? `${compact(h.stats?.flows ?? 0)} flows/min`}</div>
                      </td>
                      <td className="py-1.5">
                        <StateChip state={h.current_state} />
                        {h.truth_state && h.truth_state !== h.current_state && <div className="text-[10px] text-ink-3">label: {h.truth_state.toLowerCase().replace(/_/g, " ")}</div>}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-ink-1">{pct(h.attack_probability)}</td>
                      <td className="px-3 py-1.5 text-right"><RiskBadge level={h.risk_level} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="Alerts raised in this replay" subtitle="Persisted to the alert queue and the audit chain.">
            {liveAlerts.length === 0 ? <EmptyState title="No alerts yet">Press Start - alerts appear when a host enters the early-warning condition.</EmptyState> : (
              <ul className="space-y-1.5 text-xs">
                {liveAlerts.map((a) => (
                  <li key={a.id} className="flex gap-2"><span className="w-10 shrink-0 tabular-nums text-ink-3">m{a.t}</span><span className="text-ink-2">{a.title}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title={activeHost ? <span>Forecast for <span className="font-mono">{activeHost}</span> at minute {t}</span> : "Forecast"}
          subtitle={snap?.hosts.find((h) => h.host === activeHost)?.role ?? undefined}
          action={fcLoading ? <Pill>updating...</Pill> : fc ? <Pill tone="info">K = {fc.horizon} min</Pill> : null}>
          {fcErr ? <ErrorState error={fcErr} /> : !fc ? <Skeleton className="h-96" /> : <ForecastDetail fc={fc} />}
        </Card>
      </div>
    </div>
  );
}
