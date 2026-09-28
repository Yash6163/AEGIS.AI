"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/Shell";
import { ConfusionMatrix, HBars, LineChart, Reliability } from "@/components/charts/charts";
import { MultiDataset } from "@/components/MultiDataset";
import { Card, ErrorState, Pill, Segmented, Skeleton, StateChip, useApi } from "@/components/ui";
import type { StateName } from "@/lib/api";
import { STATE_SHORT, num, pct } from "@/lib/states";

type PM = { n: number; accuracy: number; macro_f1: number; top3_accuracy: number; brier: number; nll: number; ece: number;
  attack_precision: number; attack_recall: number; n_state_changes: number; state_change_accuracy: number | null };
type Bin = { lo: number; hi: number; n: number; accuracy: number; confidence: number };
type LeadSummary = { n_onsets: number; forecast_before_onset_rate?: number; mean_lead_minutes?: number; median_lead_minutes_when_forecast?: number; detected_at_onset_rate?: number };
type Metrics = {
  generated_at: string;
  protocol: { type: string; block_minutes: number; history: number; max_horizon: number; mc_samples: number; unit: string; n_samples: number; state_support_current: Record<string, number> };
  horizons: number[];
  forecast: Record<string, Record<string, PM>>;
  world_model_macro_f1_per_fold: Record<string, number[]>;
  world_model_detail: Record<string, { per_class: { state: StateName; precision: number; recall: number; f1: number; support: number }[]; confusion_matrix: number[][]; reliability: Bin[] }>;
  early_warning: { horizon: number; models: Record<string, { auroc: number | null; auprc: number | null; recall_at_threshold?: number | null; precision_at_threshold?: number | null; false_alarm_rate_at_threshold?: number | null; positives: number }> };
  lead_time: { definition: string; all: LeadSummary; campaign_reonset: LeadSummary; cold_onset: LeadSummary; by_state: Record<string, LeadSummary>; false_warnings_per_host_hour: number; quiet_samples: number };
  permutation_importance: { target: string; features: { feature: string; mean_nll_increase: number; std: number }[] };
  inference_latency_ms_per_host: { mean: number; mc_samples: number; horizon: number };
};
type Card_ = {
  model_version: string; model_type: string; created_at: string; dataset: string; weights_sha256: string; window_seconds: number;
  history_minutes: number; max_horizon_minutes: number; internal_networks: string; temperature: number;
  hyperparameters: Record<string, unknown>; training: { n_train: number; n_val: number; parameters: number; selected_seed: number };
  early_warning: { horizon: number; threshold: number; selection?: string };
  features: { name: string; description: string }[];
  states: { state: StateName; label: string; severity: number; compromise: boolean; mitre_tactic: string | null; mitre_tactic_id: string | null; description: string }[];
  label_mapping: { dataset_label: string; state: StateName }[];
};

const MODELS: { key: string; name: string; color: string; deployable: boolean }[] = [
  { key: "world_model", name: "World model (ours)", color: "#3987e5", deployable: true },
  { key: "xgboost_direct", name: "XGBoost, direct per horizon", color: "#d95926", deployable: true },
  { key: "random_forest", name: "Random forest, direct", color: "#199e70", deployable: true },
  { key: "markov_nowcast", name: "Markov chain on nowcast", color: "#c98500", deployable: true },
  { key: "persistence_oracle", name: "Persistence (true current state)", color: "#8f8e86", deployable: false },
  { key: "markov_oracle", name: "Markov (true current state)", color: "#5f5e58", deployable: false },
  { key: "majority", name: "Always NORMAL", color: "#4a4a45", deployable: true },
];
const METRICS: { key: keyof PM; label: string; fmt: (v: number) => string; lowerBetter?: boolean }[] = [
  { key: "macro_f1", label: "Macro-F1", fmt: (v) => v.toFixed(3) },
  { key: "attack_recall", label: "Attack recall", fmt: (v) => pct(v) },
  { key: "attack_precision", label: "Attack precision", fmt: (v) => pct(v) },
  { key: "state_change_accuracy", label: "Acc. on state changes", fmt: (v) => pct(v) },
  { key: "brier", label: "Brier", fmt: (v) => v.toFixed(4), lowerBetter: true },
  { key: "accuracy", label: "Accuracy", fmt: (v) => pct(v, 1) },
];

/** F-beta from precision and recall; beta < 1 favours precision. */
function fbeta(p: number | null | undefined, r: number | null | undefined, b: number): number | null {
  if (p == null || r == null || b * b * p + r === 0) return null;
  return ((1 + b * b) * p * r) / (b * b * p + r);
}

export default function ModelPage() {
  const m = useApi<Metrics>("/model/metrics");
  const card = useApi<Card_>("/model");
  const [metric, setMetric] = useState<keyof PM>("macro_f1");
  const [k, setK] = useState("1");
  const d = m.data;
  const available = MODELS.filter((x) => d?.forecast[x.key]);
  const mdef = METRICS.find((x) => x.key === metric)!;

  return (
    <div className="space-y-4">
      <PageHeader title="Model & evaluation"
        description="Every number on this page is read from metrics.json, written by ml/evaluate.py from out-of-fold predictions. Nothing is typed in by hand." />
      {(m.error || card.error) && <ErrorState error={m.error ?? card.error} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Model card" className="lg:col-span-1">
          {!card.data ? <Skeleton className="h-60" /> : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              {[
                ["version", card.data.model_version],
                ["architecture", card.data.model_type],
                ["parameters", card.data.training.parameters.toLocaleString()],
                ["input", `${card.data.history_minutes} x ${card.data.window_seconds}s windows x ${card.data.features.length} features per host`],
                ["forecast", `K = 1..${card.data.max_horizon_minutes} min, ancestral sampling`],
                ["dataset", card.data.dataset],
                ["hosts", card.data.internal_networks],
                ["training", `${card.data.training.n_train.toLocaleString()} train / ${card.data.training.n_val.toLocaleString()} val host-minutes`],
                ["calibration", `temperature ${card.data.temperature}`],
                ["early warning", `P(attack ≤ ${card.data.early_warning.horizon} min) ≥ ${card.data.early_warning.threshold} (threshold maximises validation F0.5)`],
                ["weights sha256", <span key="h" className="break-all font-mono text-[10px]">{card.data.weights_sha256}</span>],
              ].map(([k2, v]) => (
                <React.Fragment key={String(k2)}><dt className="text-ink-3">{k2}</dt><dd className="text-ink-1">{v}</dd></React.Fragment>
              ))}
            </dl>
          )}
        </Card>
        <Card title="Evaluation protocol" className="lg:col-span-2">
          {!d ? <Skeleton className="h-40" /> : (
            <div className="space-y-2 text-xs text-ink-2">
              <p><b className="text-ink-1">{d.protocol.type}.</b> Capture days are cut into {d.protocol.block_minutes}-minute blocks; each block belongs to exactly one fold, and a sample&apos;s history and future targets never cross a block boundary - so no minute of traffic or label is shared between training and test. {d.protocol.n_samples.toLocaleString()} test samples ({d.protocol.unit}).</p>
              <p>Early stopping, temperature and the warning threshold use a separate validation fold. Hyper-parameters were chosen on validation folds only.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(d.protocol.state_support_current).map(([s, c]) => (
                  <span key={s} className="rounded border border-line px-1.5 py-0.5"><StateChip state={s as StateName} /> <span className="tabular-nums text-ink-3">{c.toLocaleString()}</span></span>
                ))}
              </div>
              <p className="text-ink-3">Support is tiny for exploitation, infiltration and reconnaissance (single short episodes in CIC-IDS2017); per-class scores for them are not statistically meaningful.</p>
            </div>
          )}
        </Card>
      </div>

      <Card title="Forecast quality by horizon" subtitle="Pooled out-of-fold. Dashed/gray models use the TRUE current state and are not deployable - they are reference points."
        action={<Segmented label="Metric" value={metric} onChange={setMetric} options={METRICS.slice(0, 5).map((x) => ({ value: x.key, label: x.label }))} />}>
        {!d ? <Skeleton className="h-60" /> : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <LineChart xLabels={d.horizons.map((h) => (h === 0 ? "now" : `+${h} min`))}
                yMax={mdef.key === "brier" ? 0.1 : 1} yFormat={(v) => (mdef.key === "brier" ? v.toFixed(2) : v.toFixed(2))}
                series={available.filter((x) => x.key !== "majority").map((x) => ({
                  name: x.name, color: x.color, dashed: !x.deployable,
                  values: d.horizons.map((h) => (d.forecast[x.key][String(h)]?.[metric] as number | null) ?? null),
                }))} />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">
                {available.filter((x) => x.key !== "majority").map((x) => (
                  <span key={x.key} className="inline-flex items-center gap-1">
                    <span className="h-0.5 w-4" style={{ background: x.color, borderTop: x.deployable ? undefined : `2px dashed ${x.color}` }} />{x.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-ink-3"><tr><th className="py-1 text-left font-normal">model</th>{d.horizons.map((h) => <th key={h} className="py-1 text-right font-normal">{h === 0 ? "now" : `+${h}`}</th>)}</tr></thead>
                <tbody>
                  {available.map((x) => (
                    <tr key={x.key} className="border-t border-line">
                      <td className={`py-1.5 pr-2 ${x.deployable ? "text-ink-1" : "text-ink-3"}`}>{x.name}</td>
                      {d.horizons.map((h) => {
                        const v = d.forecast[x.key][String(h)]?.[metric] as number | null | undefined;
                        const best = Math.max(...MODELS.filter((mm) => mm.deployable && d.forecast[mm.key]).map((mm) => (d.forecast[mm.key][String(h)]?.[metric] as number) ?? -1));
                        const isBest = !mdef.lowerBetter && x.deployable && v === best;
                        return <td key={h} className={`py-1.5 text-right tabular-nums ${isBest ? "font-semibold text-ink-1" : "text-ink-2"}`}>{v === null || v === undefined ? "-" : mdef.fmt(v)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-ink-3">Bold = best deployable model at that horizon. Accuracy is dominated by NORMAL (~98% of host-minutes); read macro-F1 and attack recall instead.</p>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Early warning: attack within ${d?.early_warning.horizon ?? 5} minutes`} subtitle="Binary target: any attack state in the next minutes. Each model's threshold maximises F0.5 on its validation fold - the same rule for every model.">
          {!d ? <Skeleton className="h-40" /> : (
            <table className="w-full text-xs">
              <thead className="text-ink-3"><tr><th className="py-1 text-left font-normal">model</th><th className="text-right font-normal">AUROC</th><th className="text-right font-normal">AUPRC</th><th className="text-right font-normal">recall</th><th className="text-right font-normal">precision</th><th className="text-right font-normal">F0.5</th><th className="text-right font-normal">F1</th><th className="text-right font-normal">F2</th><th className="text-right font-normal">false alarms</th></tr></thead>
              <tbody>
                {Object.entries(d.early_warning.models).map(([name, r]) => (
                  <tr key={name} className="border-t border-line">
                    <td className="py-1.5 text-ink-1">{name.replace(/_/g, " ")}</td>
                    <td className="text-right tabular-nums">{num(r.auroc, 3)}</td>
                    <td className="text-right tabular-nums">{num(r.auprc, 3)}</td>
                    <td className="text-right tabular-nums">{pct(r.recall_at_threshold ?? null)}</td>
                    <td className="text-right tabular-nums">{pct(r.precision_at_threshold ?? null)}</td>
                    {[0.5, 1, 2].map((b) => <td key={b} className="text-right tabular-nums">{num(fbeta(r.precision_at_threshold, r.recall_at_threshold, b), 3)}</td>)}
                    <td className="text-right tabular-nums">{pct(r.false_alarm_rate_at_threshold ?? null, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Forecast lead time" subtitle={d?.lead_time.definition}>
          {!d ? <Skeleton className="h-40" /> : (
            <>
              <table className="w-full text-xs">
                <thead className="text-ink-3"><tr><th className="py-1 text-left font-normal">onsets</th><th className="text-right font-normal">n</th><th className="text-right font-normal">warned before onset</th><th className="text-right font-normal">median lead</th><th className="text-right font-normal">detected at onset</th></tr></thead>
                <tbody>
                  {([["all", d.lead_time.all], ["within a running campaign", d.lead_time.campaign_reonset], ["cold (no attack in prior 10 min)", d.lead_time.cold_onset],
                    ...Object.entries(d.lead_time.by_state).map(([s, v]) => [`  ${STATE_SHORT[s as StateName] ?? s}`, v] as [string, LeadSummary])] as [string, LeadSummary][]).map(([label, v]) => (
                    <tr key={label} className="border-t border-line">
                      <td className="py-1.5 whitespace-pre text-ink-1">{label}</td>
                      <td className="text-right tabular-nums">{v.n_onsets}</td>
                      <td className="text-right tabular-nums">{pct(v.forecast_before_onset_rate)}</td>
                      <td className="text-right tabular-nums">{v.median_lead_minutes_when_forecast ? `${v.median_lead_minutes_when_forecast} min` : "-"}</td>
                      <td className="text-right tabular-nums">{pct(v.detected_at_onset_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-ink-3">Lead is capped at 5 minutes by design. Most onsets are re-onsets inside a running campaign (e.g. periodic botnet beacons); cold onsets after quiet traffic are largely unpredictable from traffic alone. False warnings: {num(d.lead_time.false_warnings_per_host_hour, 2)} per host-hour of quiet traffic.</p>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Confusion matrix" className="lg:col-span-2" action={<Segmented label="Horizon" value={k} onChange={setK} options={[{ value: "0", label: "now" }, { value: "1", label: "+1" }, { value: "5", label: "+5" }]} />}>
          {!d ? <Skeleton className="h-48" /> : <ConfusionMatrix matrix={d.world_model_detail[k].confusion_matrix} labels={d.world_model_detail[k].per_class.map((c) => STATE_SHORT[c.state])} />}
          {d && (
            <table className="mt-3 w-full text-xs">
              <thead className="text-ink-3"><tr><th className="py-1 text-left font-normal">state</th><th className="text-right font-normal">precision</th><th className="text-right font-normal">recall</th><th className="text-right font-normal">F1</th><th className="text-right font-normal">support</th></tr></thead>
              <tbody>{d.world_model_detail[k].per_class.map((c) => (
                <tr key={c.state} className="border-t border-line"><td className="py-1"><StateChip state={c.state} /></td>
                  <td className="text-right tabular-nums">{c.support ? c.precision.toFixed(2) : "-"}</td><td className="text-right tabular-nums">{c.support ? c.recall.toFixed(2) : "-"}</td>
                  <td className="text-right tabular-nums">{c.support ? c.f1.toFixed(2) : "-"}</td><td className="text-right tabular-nums text-ink-3">{c.support}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Calibration" subtitle={d ? `Top-label reliability at ${k === "0" ? "now" : `+${k} min`}; ECE ${num(d.forecast.world_model[k]?.ece, 3)}. Dots on the diagonal = calibrated; size = sample count.` : undefined}>
          {!d ? <Skeleton className="h-48" /> : <Reliability bins={d.world_model_detail[k].reliability} />}
        </Card>
      </div>

      <MultiDataset />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Global feature importance" subtitle={d ? `Permutation importance: increase in ${d.permutation_importance.target} when a feature is shuffled across test samples (mean of 5 folds).` : undefined}>
          {!d ? <Skeleton className="h-60" /> : (
            <HBars format={(v) => v.toFixed(3)} items={d.permutation_importance.features.slice(0, 12).map((f) => ({
              label: card.data?.features.find((x) => x.name === f.feature)?.description ?? f.feature, sub: f.feature, value: Math.max(f.mean_nll_increase, 0),
            }))} />
          )}
        </Card>
        <Card title="Attack states and dataset mapping" subtitle="States are coarse kill-chain stages. Only stages CIC-IDS2017 has labelled traffic for are modelled; MITRE ATT&CK tactics are indicative, not technique-level detection.">
          {!card.data ? <Skeleton className="h-60" /> : (
            <table className="w-full text-xs">
              <thead className="text-ink-3"><tr><th className="py-1 text-left font-normal">state</th><th className="text-left font-normal">ATT&CK tactic</th><th className="text-left font-normal">CIC-IDS2017 labels</th><th className="text-right font-normal">severity</th></tr></thead>
              <tbody>{card.data.states.map((s) => (
                <tr key={s.state} className="border-t border-line align-top">
                  <td className="py-1.5"><StateChip state={s.state} />{s.compromise && <div className="mt-0.5"><Pill>compromise-class</Pill></div>}</td>
                  <td className="py-1.5 text-ink-2">{s.mitre_tactic ? `${s.mitre_tactic} (${s.mitre_tactic_id})` : "-"}</td>
                  <td className="py-1.5 text-ink-3">{card.data!.label_mapping.filter((l) => l.state === s.state).map((l) => l.dataset_label).join(", ")}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.severity.toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      </div>
      {d && <p className="text-[11px] text-ink-3">metrics generated {d.generated_at} · mean inference latency {d.inference_latency_ms_per_host.mean.toFixed(2)} ms per host ({d.inference_latency_ms_per_host.mc_samples} samples, K={d.inference_latency_ms_per_host.horizon}, batched)</p>}
    </div>
  );
}
