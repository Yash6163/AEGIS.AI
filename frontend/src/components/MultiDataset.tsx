"use client";

import React from "react";
import { Card, EmptyState, Skeleton, useApi } from "./ui";
import { num, pct } from "@/lib/states";

type EW = { auroc?: number; auprc?: number; precision: number; recall: number; f05: number; f1: number; false_alarm_rate: number; positives?: number };
type Res = { states: Record<string, { macro_f1: number }>; early_warning: EW; n_samples: number; trained_on?: string[];
  lead_time?: { n_onsets: number; warned_before_onset_rate: number | null } };
type Multi = {
  E1_single: Record<string, Res>; E1_xgb_single: Record<string, Res>; E2_joint: Record<string, Res>; E2_xgb_joint: Record<string, Res>;
  E3_lodo: Record<string, Res>; E4_cases: Record<string, Res>; E5_transfer?: Record<string, Record<string, Res>>;
  protocol: { support: Record<string, Record<string, number>>; cv_datasets: string[] }; portable_model: string | null;
};

const E5_LABEL: Record<string, string> = {
  portable_model: "portable", portable_model_self_calibrated: "portable + self-cal.",
  cic_model: "CIC (prod)", cic_model_self_calibrated: "CIC + self-cal.",
};

const LABEL: Record<string, string> = {
  cic2017: "CIC-IDS2017", unsw: "UNSW-NB15", ctu13: "CTU-13", darpa2000: "DARPA 2000 (PCAP)", cic2018: "CSE-CIC-IDS2018",
};

function Cell({ v, best, fmt = (x: number) => num(x, 3) }: { v?: number; best?: boolean; fmt?: (x: number) => string }) {
  return <td className={`py-1.5 text-right tabular-nums ${best ? "font-semibold text-ink-1" : "text-ink-2"}`}>{v === undefined ? "-" : fmt(v)}</td>;
}

export function MultiDataset() {
  const { data, error } = useApi<Multi>("/model/metrics/multi");
  if (error) return <Card title="Multi-dataset evaluation"><EmptyState title="Not available">{error.message}</EmptyState></Card>;
  if (!data) return <Skeleton className="h-60" />;
  const rows = data.protocol.cv_datasets;
  const metricRow = (label: string, get: (r?: Res) => number | undefined, fmt?: (x: number) => string) => (
    <tr className="border-t border-line">
      <td className="py-1.5 pr-2 text-ink-3">{label}</td>
      {rows.flatMap((d) => {
        const vals = [get(data.E1_single[d]), get(data.E2_joint[d]), get(data.E1_xgb_single[d])];
        const max = Math.max(...vals.filter((v): v is number => v !== undefined));
        return vals.map((v, i) => <Cell key={d + i} v={v} best={v === max} fmt={fmt} />);
      })}
    </tr>
  );
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card title="Multi-dataset evaluation (portable 26 flow features)"
        subtitle="5-fold blocked CV inside each dataset. 'Single' = trained on that dataset only; 'Joint' = one model trained on all three; XGBoost = classical baseline on the same data. Bold = best of the three.">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-ink-3">
              <tr><th />{rows.map((d) => <th key={d} colSpan={3} className="pb-1 text-center font-medium text-ink-2">{LABEL[d] ?? d}</th>)}</tr>
              <tr><th className="text-left font-normal">metric</th>{rows.flatMap((d) => ["single", "joint", "XGB"].map((h) => <th key={d + h} className="text-right font-normal">{h}</th>))}</tr>
            </thead>
            <tbody>
              {metricRow("early-warning AUROC", (r) => r?.early_warning.auroc)}
              {metricRow("early-warning AUPRC", (r) => r?.early_warning.auprc)}
              {metricRow("early-warning F0.5", (r) => r?.early_warning.f05)}
              {metricRow("warning precision", (r) => r?.early_warning.precision, (x) => pct(x))}
              {metricRow("warning recall", (r) => r?.early_warning.recall, (x) => pct(x))}
              {metricRow("macro-F1 +1 min", (r) => r?.states["1"]?.macro_f1)}
              {metricRow("macro-F1 +5 min", (r) => r?.states["5"]?.macro_f1)}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Transfer to unseen networks" subtitle="Zero-shot: the model never saw any traffic from the target dataset. This is where accuracy drops - the honest edge case.">
        <table className="w-full text-xs">
          <thead className="text-ink-3"><tr><th className="text-left font-normal">target</th><th className="text-left font-normal">trained on</th><th className="text-right font-normal">AUROC</th><th className="text-right font-normal">AUPRC</th><th className="text-right font-normal">F0.5</th></tr></thead>
          <tbody>
            {Object.entries(data.E3_lodo).map(([d, r]) => (
              <tr key={d} className="border-t border-line"><td className="py-1.5 text-ink-1">{LABEL[d] ?? d}</td>
                <td className="text-ink-3">{(r.trained_on ?? []).map((x) => LABEL[x] ?? x).join(" + ")}</td>
                <Cell v={r.early_warning.auroc} /><Cell v={r.early_warning.auprc} /><Cell v={r.early_warning.f05} /></tr>
            ))}
            {Object.entries(data.E4_cases).map(([d, r]) => (
              <tr key={d} className="border-t border-line"><td className="py-1.5 text-ink-1">{LABEL[d] ?? d}</td>
                <td className="text-ink-3">all three (case study)</td>
                <Cell v={r.early_warning.auroc} /><Cell v={r.early_warning.auprc} /><Cell v={r.early_warning.f05} /></tr>
            ))}
          </tbody>
        </table>
        {data.E5_transfer && (
          <>
            <p className="mt-3 text-[11px] font-medium text-ink-2">Shipped models on unseen captures (E5). Self-cal. = standardise with the target network&apos;s own traffic statistics, no labels.</p>
            <table className="mt-1 w-full text-xs">
              <thead className="text-ink-3"><tr><th className="text-left font-normal">target</th><th className="text-left font-normal">model</th><th className="text-right font-normal">AUROC</th><th className="text-right font-normal">AUPRC</th><th className="text-right font-normal">F0.5</th></tr></thead>
              <tbody>
                {Object.entries(data.E5_transfer).flatMap(([d, byModel]) => Object.entries(byModel).map(([m, r]) => (
                  <tr key={d + m} className="border-t border-line"><td className="py-1.5 text-ink-1">{LABEL[d] ?? d}</td>
                    <td className="text-ink-3">{E5_LABEL[m] ?? m}</td>
                    <Cell v={r.early_warning.auroc} /><Cell v={r.early_warning.auprc} /><Cell v={r.early_warning.f05} /></tr>
                )))}
              </tbody>
            </table>
          </>
        )}
        {data.portable_model && <p className="mt-2 text-[11px] text-ink-3">Serving model for binetflow / UNSW / PCAP uploads: {data.portable_model}</p>}
      </Card>
    </div>
  );
}
