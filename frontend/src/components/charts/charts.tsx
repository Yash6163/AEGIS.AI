"use client";

import React, { useMemo, useState } from "react";
import type { StateName, StepForecast, TreeNode } from "@/lib/api";
import { STATE_COLOR, STATE_LABEL, STATE_ORDER, STATE_SHORT, pct } from "@/lib/states";

const AXIS = "#8f8e86";
const GRID = "#2c2c29";
const SURFACE = "#1a1a19";

// --------------------------------------------------------------- tooltip
function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  const Tip = tip ? (
    <div
      className="pointer-events-none absolute z-20 max-w-xs rounded-md border border-line-strong bg-surface-2 px-2.5 py-2 text-xs text-ink-1 shadow-xl"
      style={{ left: tip.x + 12, top: tip.y + 12 }}
      role="tooltip"
    >
      {tip.content}
    </div>
  ) : null;
  return { setTip, Tip };
}

function rel(e: React.MouseEvent, el: HTMLElement | null) {
  const r = el?.getBoundingClientRect();
  return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
}

export function StateLegend({ states = STATE_ORDER, extra }: { states?: (StateName | "OTHER")[]; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2" aria-label="Legend">
      {states.map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATE_COLOR[s] }} aria-hidden />
          {STATE_LABEL[s]}
        </span>
      ))}
      {extra}
    </div>
  );
}

// ------------------------------------------------ per-step state forecast
/** Stacked columns: P(state) at each future minute, with optional ground truth. */
export function ProbabilityColumns({ steps, truth }: { steps: StepForecast[]; truth?: (StateName | null)[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { setTip, Tip } = useTip();
  const W = 640, H = 220, padL = 36, padB = truth ? 46 : 26, padT = 8;
  const cw = (W - padL) / steps.length;
  const bw = Math.min(46, cw * 0.62);
  const ih = H - padB - padT;
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Forecast probability of each attack state per future minute">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W} y1={padT + ih * (1 - v)} y2={padT + ih * (1 - v)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={padT + ih * (1 - v) + 3} fontSize={10} fill={AXIS} textAnchor="end">{v * 100}%</text>
          </g>
        ))}
        {steps.map((s, i) => {
          const x = padL + i * cw + (cw - bw) / 2;
          let y = padT + ih;
          const segs = STATE_ORDER.map((st) => ({ st, p: s.distribution[st] ?? 0 })).filter((d) => d.p > 0.002);
          return (
            <g key={i}
              onMouseMove={(e) => setTip({ ...rel(e, ref.current), content: (
                <div>
                  <div className="mb-1 font-semibold">{i === 0 ? "Now (t)" : `t + ${i} min`}</div>
                  {segs.slice().sort((a, b) => b.p - a.p).map((d) => (
                    <div key={d.st} className="flex justify-between gap-4"><span>{STATE_LABEL[d.st]}</span><span className="tabular-nums">{pct(d.p, 1)}</span></div>
                  ))}
                  <div className="mt-1 text-ink-3">confidence: {s.confidence_band.toLowerCase()}</div>
                </div>) })}
              onMouseLeave={() => setTip(null)}>
              <rect x={padL + i * cw} y={padT} width={cw} height={ih} fill="transparent" />
              {segs.map((d, j) => {
                const h = d.p * ih;
                y -= h;
                const top = j === segs.length - 1;
                return <rect key={d.st} x={x} y={y + (top ? 0 : 1)} width={bw} height={Math.max(h - (top ? 0 : 1) - 1, 0.5)} rx={top ? 3 : 0} fill={STATE_COLOR[d.st]} />;
              })}
              <text x={x + bw / 2} y={H - padB + 14} fontSize={10} fill={AXIS} textAnchor="middle">{i === 0 ? "now" : `+${i}`}</text>
              {s.confidence_band === "UNCERTAIN" && (
                <text x={x + bw / 2} y={padT + 10} fontSize={9} fill="#fab219" textAnchor="middle">?</text>
              )}
              {truth && (
                <g>
                  <rect x={x} y={H - 22} width={bw} height={10} rx={2}
                    fill={truth[i] ? STATE_COLOR[truth[i] as StateName] : "none"} stroke={truth[i] ? "none" : GRID} strokeDasharray="2 2" />
                </g>
              )}
            </g>
          );
        })}
        {truth && <text x={padL - 6} y={H - 14} fontSize={9} fill={AXIS} textAnchor="end">actual</text>}
      </svg>
      {Tip}
    </div>
  );
}

// ------------------------------------------------------ trajectory tree
type LaidNode = { node: TreeNode; x: number; y: number; h: number; parent?: LaidNode };

/** Branching tree of Monte-Carlo trajectories; node height = joint probability. */
export function TrajectoryTree({ roots, depth }: { roots: TreeNode[]; depth: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { setTip, Tip } = useTip();
  const W = 680, H = 260, colW = W / (depth + 1), nodeW = 12, gap = 3;
  const laid = useMemo(() => {
    const out: LaidNode[] = [];
    const place = (nodes: TreeNode[], y0: number, span: number, parent?: LaidNode) => {
      const total = nodes.reduce((a, n) => a + n.probability, 0) || 1;
      let y = y0;
      const usable = span - gap * Math.max(nodes.length - 1, 0);
      for (const n of nodes) {
        const h = Math.max((n.probability / total) * usable, 2);
        const ln: LaidNode = { node: n, x: n.step * colW + 8, y, h, parent };
        out.push(ln);
        if (n.children.length) place(n.children, y, h, ln);
        y += h + gap;
      }
    };
    place(roots, 8, H - 16);
    return out;
  }, [roots, colW]);
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Branching attack trajectory tree">
        {Array.from({ length: depth + 1 }, (_, k) => (
          <text key={k} x={k * colW + 8} y={H - 1} fontSize={10} fill={AXIS}>{k === 0 ? "now" : `+${k} min`}</text>
        ))}
        {laid.filter((l) => l.parent).map((l, i) => {
          const p = l.parent!;
          const x1 = p.x + nodeW, x2 = l.x;
          const y1 = p.y + p.h / 2, y2 = l.y + l.h / 2;
          const mx = (x1 + x2) / 2;
          return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none"
            stroke={STATE_COLOR[l.node.state]} strokeOpacity={0.45} strokeWidth={Math.max(1.5, Math.min(l.h, 18))} />;
        })}
        {laid.map((l, i) => (
          <g key={i}
            onMouseMove={(e) => setTip({ ...rel(e, ref.current), content: (
              <div>
                <div className="font-semibold">{STATE_LABEL[l.node.state]} {l.node.step === 0 ? "(now)" : `at +${l.node.step} min`}</div>
                <div>path probability <span className="tabular-nums">{pct(l.node.probability, 1)}</span></div>
                {l.node.step > 0 && <div className="text-ink-3">given previous step: {pct(l.node.conditional_probability, 1)}</div>}
              </div>) })}
            onMouseLeave={() => setTip(null)}>
            <rect x={l.x} y={l.y} width={nodeW} height={l.h} rx={3} fill={STATE_COLOR[l.node.state]} stroke={SURFACE} strokeWidth={1} />
            {l.h >= 14 && (
              <text x={l.x + nodeW + 4} y={l.y + l.h / 2 + 3} fontSize={10} fill="#f4f3ef">
                {STATE_SHORT[l.node.state]} <tspan fill={AXIS}>{pct(l.node.probability)}</tspan>
              </text>
            )}
          </g>
        ))}
      </svg>
      {Tip}
    </div>
  );
}

/** Width of an element in CSS pixels (so SVG text renders at its nominal size). */
function useWidth(ref: React.RefObject<HTMLElement>, fallback = 900) {
  const [w, setW] = useState(fallback);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// ---------------------------------------------------------- state strip
/** Rows of per-minute states (e.g. hosts x minutes) with a cursor. */
export function StateStrip({ rows, cursor, onPick, height = 12, labelWidth = 130 }: {
  rows: { label: string; states: (StateName | null)[]; sub?: string }[];
  cursor?: number; onPick?: (t: number, row: number) => void; height?: number; labelWidth?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { setTip, Tip } = useTip();
  const n = rows[0]?.states.length ?? 0;
  const W = useWidth(ref), rowH = height + 3, H = rows.length * rowH + 4;
  const cw = (W - labelWidth) / Math.max(n, 1);
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block cursor-crosshair" role="img" aria-label="Attack states over time per host"
        onMouseLeave={() => setTip(null)}
        onMouseMove={(e) => {
          const svg = e.currentTarget.getBoundingClientRect();
          const sx = ((e.clientX - svg.left) / svg.width) * W;
          const sy = ((e.clientY - svg.top) / svg.height) * H;
          const t = Math.floor((sx - labelWidth) / cw), r = Math.floor(sy / rowH);
          if (t < 0 || t >= n || r < 0 || r >= rows.length) return setTip(null);
          const s = rows[r].states[t];
          setTip({ ...rel(e, ref.current), content: <div><div className="font-semibold">{rows[r].label}</div><div>minute {t}: {s ? STATE_LABEL[s] : "Normal"}</div></div> });
        }}
        onClick={(e) => {
          if (!onPick) return;
          const svg = e.currentTarget.getBoundingClientRect();
          const t = Math.floor((((e.clientX - svg.left) / svg.width) * W - labelWidth) / cw);
          const r = Math.floor((((e.clientY - svg.top) / svg.height) * H) / rowH);
          if (t >= 0 && t < n) onPick(t, Math.min(Math.max(r, 0), rows.length - 1));
        }}>
        {rows.map((row, r) => (
          <g key={r}>
            <text x={0} y={r * rowH + height - 1} fontSize={Math.min(11, height + 1)} fill="#c3c2b7" fontFamily="ui-monospace, monospace">{row.label}</text>
            <rect x={labelWidth} y={r * rowH} width={W - labelWidth} height={height} fill="#1f1f1d" rx={2} />
            {row.states.map((s, t) => s && s !== "NORMAL" ? (
              <rect key={t} x={labelWidth + t * cw} y={r * rowH} width={Math.max(cw, 1)} height={height} fill={STATE_COLOR[s]} />
            ) : null)}
          </g>
        ))}
        {cursor !== undefined && (
          <line x1={labelWidth + (cursor + 0.5) * cw} x2={labelWidth + (cursor + 0.5) * cw} y1={0} y2={H} stroke="#f4f3ef" strokeWidth={1.5} />
        )}
      </svg>
      {Tip}
    </div>
  );
}

// ------------------------------------------------------ diverging bars
export function DivergingBars({ items, format = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} pp` }: {
  items: { label: string; sub?: string; value: number }[]; format?: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1e-6);
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4.5rem] items-center gap-2 text-xs" title={it.sub}>
          <div className="truncate text-ink-2">{it.label}</div>
          <div className="relative h-3.5">
            <div className="absolute left-1/2 top-0 h-full w-px bg-line-strong" />
            <div className="absolute top-0.5 h-2.5 rounded-sm"
              style={{
                background: it.value >= 0 ? "#e66767" : "#3987e5",
                left: it.value >= 0 ? "50%" : `${50 - (Math.abs(it.value) / max) * 50}%`,
                width: `${(Math.abs(it.value) / max) * 50}%`,
              }} />
          </div>
          <div className="text-right tabular-nums text-ink-1">{format(it.value)}</div>
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------- line chart
export function LineChart({ series, xLabels, yMax = 1, yFormat = (v: number) => v.toFixed(1), height = 220 }: {
  series: { name: string; color: string; values: (number | null)[]; dashed?: boolean }[];
  xLabels: string[]; yMax?: number; yFormat?: (v: number) => string; height?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { setTip, Tip } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const W = useWidth(ref, 640), H = height, padL = 40, padR = 16, padT = 8, padB = 22;
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = (i: number) => padL + (xLabels.length === 1 ? iw / 2 : (i / (xLabels.length - 1)) * iw);
  const y = (v: number) => padT + ih * (1 - v / yMax);
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label={series.map((s) => s.name).join(", ")}
        onMouseLeave={() => { setHover(null); setTip(null); }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const sx = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((sx - padL) / iw) * (xLabels.length - 1));
          if (i < 0 || i >= xLabels.length) return;
          setHover(i);
          setTip({ ...rel(e, ref.current), content: (
            <div>
              <div className="mb-1 font-semibold">{xLabels[i]}</div>
              {series.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
                  <span className="tabular-nums">{s.values[i] === null ? "-" : yFormat(s.values[i] as number)}</span>
                </div>
              ))}
            </div>) });
        }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={y(f * yMax)} y2={y(f * yMax)} stroke={GRID} />
            <text x={padL - 6} y={y(f * yMax) + 3} fontSize={10} fill={AXIS} textAnchor="end">{yFormat(f * yMax)}</text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          (xLabels.length <= 12 || i % Math.ceil(xLabels.length / 12) === 0) &&
          <text key={i} x={x(i)} y={H - 6} fontSize={10} fill={AXIS} textAnchor="middle">{l}</text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="#4a4a45" />}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(Math.min(v, yMax))] as const));
          const d = pts.reduce((acc, p, i) => (p ? acc + `${acc && pts[i - 1] ? "L" : "M"}${p[0]},${p[1]}` : acc), "");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
              {pts.length <= 12 && pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />)}
            </g>
          );
        })}
      </svg>
      {Tip}
    </div>
  );
}

// ----------------------------------------------------- confusion matrix
export function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const rowsWithSupport = matrix.map((r, i) => ({ r, i })).filter(({ r }) => r.reduce((a, b) => a + b, 0) > 0);
  const colsUsed = labels.map((_, j) => j).filter((j) => matrix.some((r) => r[j] > 0) || rowsWithSupport.some(({ i }) => i === j));
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px]">
        <thead>
          <tr>
            <th className="p-1 text-left font-normal text-ink-3">actual \ predicted</th>
            {colsUsed.map((j) => <th key={j} className="p-1 font-normal text-ink-3">{labels[j]}</th>)}
          </tr>
        </thead>
        <tbody>
          {rowsWithSupport.map(({ r, i }) => {
            const tot = r.reduce((a, b) => a + b, 0);
            return (
              <tr key={i}>
                <th className="p-1 text-left font-normal text-ink-2">{labels[i]} <span className="text-ink-3">({tot})</span></th>
                {colsUsed.map((j) => {
                  const f = r[j] / tot;
                  return (
                    <td key={j} className="h-8 w-14 p-0.5 text-center tabular-nums" title={`${labels[i]} -> ${labels[j]}: ${r[j]} (${pct(f, 1)} of row)`}>
                      <div className="flex h-full items-center justify-center rounded-sm"
                        style={{ background: `rgba(57,135,229,${0.08 + f * 0.85})`, color: f > 0.5 ? "#fff" : "#c3c2b7" }}>
                        {r[j]}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-ink-3">Cell shade = share of the actual-state row. Counts are host-minutes.</p>
    </div>
  );
}

// ---------------------------------------------------- reliability diagram
export function Reliability({ bins }: { bins: { lo: number; hi: number; n: number; accuracy: number; confidence: number }[] }) {
  const W = 300, H = 240, pad = 32, iw = W - pad - 8, ih = H - pad - 8;
  const maxN = Math.max(...bins.map((b) => b.n), 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm" role="img" aria-label="Reliability diagram">
      <line x1={pad} y1={8 + ih} x2={pad + iw} y2={8} stroke="#4a4a45" strokeDasharray="4 4" />
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <text x={pad - 4} y={8 + ih * (1 - v) + 3} fontSize={10} fill={AXIS} textAnchor="end">{v}</text>
          <text x={pad + iw * v} y={H - 12} fontSize={10} fill={AXIS} textAnchor="middle">{v}</text>
        </g>
      ))}
      <text x={pad + iw / 2} y={H - 1} fontSize={10} fill={AXIS} textAnchor="middle">predicted confidence</text>
      {bins.map((b, i) => (
        <g key={i}>
          <title>{`confidence ${b.confidence.toFixed(2)} -> accuracy ${b.accuracy.toFixed(2)} (n=${b.n})`}</title>
          <circle cx={pad + iw * b.confidence} cy={8 + ih * (1 - b.accuracy)} r={3 + 6 * Math.sqrt(b.n / maxN)}
            fill="#3987e5" fillOpacity={0.75} stroke={SURFACE} strokeWidth={2} />
        </g>
      ))}
    </svg>
  );
}

// ------------------------------------------------------------ bars
export function HBars({ items, max, format }: { items: { label: string; value: number; sub?: string }[]; max?: number; format: (v: number) => string }) {
  const m = max ?? Math.max(...items.map((i) => i.value), 1e-9);
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_4rem] items-center gap-2 text-xs" title={it.sub}>
          <div className="truncate text-ink-2">{it.label}</div>
          <div className="h-2.5 rounded-sm bg-surface-3">
            <div className="h-full rounded-sm bg-accent" style={{ width: `${Math.max((it.value / m) * 100, 0)}%` }} />
          </div>
          <div className="text-right tabular-nums text-ink-1">{format(it.value)}</div>
        </div>
      ))}
    </div>
  );
}
