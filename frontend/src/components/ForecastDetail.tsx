"use client";

import { AlertTriangle, ArrowRight, Eye, HelpCircle } from "lucide-react";
import React from "react";
import type { Forecast } from "@/lib/api";
import { STATE_LABEL, num, pct } from "@/lib/states";
import { DivergingBars, ProbabilityColumns, StateLegend, TrajectoryTree } from "./charts/charts";
import { Card, Pill, RiskBadge, StateChip, Stat } from "./ui";

function Metric({ label, value, hint, help }: { label: string; value: React.ReactNode; hint?: React.ReactNode; help: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-0 p-3">
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
        {label}
        <span title={help} className="cursor-help"><HelpCircle className="h-3 w-3" aria-label={help} /></span>
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-ink-1">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-3">{hint}</div>}
    </div>
  );
}

export function ForecastSummary({ fc }: { fc: Forecast }) {
  const r = fc.risk;
  const next = fc.steps[1];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border border-line bg-surface-0 px-3 py-2">
          <Eye className="h-4 w-4 text-ink-3" aria-hidden />
          <div>
            <div className="text-[10px] uppercase tracking-wide text-ink-3">Current state (nowcast)</div>
            <StateChip state={fc.current.state} prob={fc.current.probability} />
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-ink-3" aria-hidden />
        {next && (
          <div className="rounded-md border border-line bg-surface-0 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-ink-3">Most likely next minute</div>
            <StateChip state={next.state} prob={next.probability} />
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <RiskBadge level={r.risk_level} score={r.risk_score} size="md" />
          {fc.early_warning.triggered && <Pill tone="warn"><AlertTriangle className="h-3 w-3" /> early warning</Pill>}
          {r.uncertain && <Pill tone="warn" title={r.uncertainty_reasons.join("; ")}>uncertain</Pill>}
          {fc.ood.flagged && <Pill tone="warn" title={fc.ood.meaning}>outside training distribution</Pill>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label="Attack probability" value={pct(r.attack_probability)}
          hint={r.expected_minutes_to_attack ? `if it happens: ~${num(r.expected_minutes_to_attack, 1)} min` : `within ${fc.horizon} min`}
          help={`Model output: share of ${fc.mc_samples} sampled trajectories that enter any attack state within the next ${fc.horizon} minutes.`} />
        <Metric label="Compromise probability" value={pct(r.compromise_probability)}
          hint="exploitation / C2 / infiltration"
          help="Model output: share of sampled trajectories reaching a compromise-class state (exploitation, command & control, infiltration) within the horizon." />
        <Metric label="Risk score" value={r.risk_score.toFixed(0)}
          hint="policy: severity x probability"
          help="Not a probability. 100 x max(current expected severity, expected peak severity over the horizon), using documented analyst severity weights per state." />
        <Metric label="Model confidence" value={pct(r.confidence)}
          hint={`MC s.e. ${pct(r.mc_standard_error, 1)}`}
          help="1 - mean normalised entropy of the forecast distributions. Low = diffuse forecast. Separate from the attack probability." />
      </div>
    </div>
  );
}

export function ForecastDetail({ fc }: { fc: Forecast }) {
  const ex = fc.explanation;
  const truth = fc.ground_truth?.states;
  return (
    <div className="space-y-4">
      <ForecastSummary fc={fc} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`State probabilities, next ${fc.horizon} minutes`}
          subtitle={truth ? "Bottom row = what the dataset labels say actually happened (not a model input)." : "Hover a column for the full distribution."}>
          <ProbabilityColumns steps={fc.steps} truth={truth ?? undefined} />
          <div className="mt-2"><StateLegend /></div>
        </Card>
        <Card title="Branching trajectories" subtitle={`${fc.mc_samples} Monte-Carlo rollouts of the world model; node height = path probability. Branches < ${pct(fc.trajectory_tree.min_probability)} grouped as Other.`}>
          <TrajectoryTree roots={fc.trajectory_tree.roots} depth={fc.trajectory_tree.depth} />
          <div className="mt-2 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-ink-3">Most likely full paths</div>
            {fc.top_trajectories.slice(0, 3).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-10 tabular-nums text-ink-2">{pct(t.probability)}</span>
                <span className="truncate text-ink-3">{collapse(t.states)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {ex && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Observed evidence" subtitle="Latest minute vs. training average (z-score). Facts, not model claims.">
            <table className="w-full text-xs">
              <thead><tr className="text-ink-3"><th className="pb-1 text-left font-normal">signal</th><th className="pb-1 text-right font-normal">observed</th><th className="pb-1 text-right font-normal">typical</th><th className="pb-1 text-right font-normal">z</th></tr></thead>
              <tbody>
                {ex.evidence.slice(0, 7).map((e) => (
                  <tr key={e.feature} className="border-t border-line">
                    <td className="py-1 pr-2 text-ink-2">{e.description}</td>
                    <td className="py-1 text-right tabular-nums text-ink-1">{fmtVal(e.observed)}</td>
                    <td className="py-1 text-right tabular-nums text-ink-3">{fmtVal(e.training_mean)}</td>
                    <td className="py-1 text-right tabular-nums" style={{ color: Math.abs(e.z_score) > 3 ? "#ec835a" : "#c3c2b7" }}>{e.z_score.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Why this forecast" subtitle={`Change in P(next = ${STATE_LABEL[ex.target_state]}) when each signal is reset to its training mean (occlusion). Red pushes towards the forecast.`}>
            <DivergingBars items={ex.feature_contributions.slice(0, 8).map((c) => ({ label: c.description, sub: c.feature, value: c.contribution }))} />
          </Card>
          <Card title="Which minutes mattered" subtitle="Same occlusion test, one history minute at a time.">
            <DivergingBars
              format={(v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} pp`}
              items={ex.temporal_contributions.slice().reverse().map((c) => ({ label: c.minutes_ago === 0 ? "current minute" : `${c.minutes_ago} min ago`, value: c.contribution }))} />
            {fc.history_padded > 0 && <p className="mt-2 text-[11px] text-ink-3">{fc.history_padded} of {fc.history_windows} history minutes precede the capture and are treated as no traffic.</p>}
          </Card>
        </div>
      )}
      <p className="text-[11px] text-ink-3">
        model {fc.model_version} · {fc.mc_samples} samples · {fc.latency_ms.toFixed(0)} ms
        {fc.context?.model_mode ? ` · ${String(fc.context.model_mode)} (fold ${String(fc.context.fold)})` : ""}
      </p>
    </div>
  );
}

function collapse(states: string[]) {
  const out: string[] = [];
  let prev = "", n = 0;
  for (const s of states) {
    if (s === prev) n++;
    else {
      if (prev) out.push(n > 1 ? `${STATE_LABEL[prev as keyof typeof STATE_LABEL]} x${n}` : STATE_LABEL[prev as keyof typeof STATE_LABEL]);
      prev = s; n = 1;
    }
  }
  if (prev) out.push(n > 1 ? `${STATE_LABEL[prev as keyof typeof STATE_LABEL]} x${n}` : STATE_LABEL[prev as keyof typeof STATE_LABEL]);
  return out.join(" -> ");
}

function fmtVal(v: number) {
  const a = Math.abs(v);
  return a >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a >= 10 ? v.toFixed(0) : v.toFixed(2);
}

export { Stat };
