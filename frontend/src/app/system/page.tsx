"use client";

import { CheckCircle2, Link2, ShieldAlert, XCircle } from "lucide-react";
import React, { useState } from "react";
import { PageHeader } from "@/components/Shell";
import { Button, Card, EmptyState, ErrorState, Skeleton, useApi } from "@/components/ui";
import { type AuditEntry, api } from "@/lib/api";
import { fmtDateTime } from "@/lib/states";

type Ready = { status: string; checks: Record<string, boolean | number>; model_version: string | null; environment: string; errors: string[] };
type Verify = { valid: boolean; entries: number; broken_at_seq: number | null; head: string };

export default function SystemPage() {
  const ready = useApi<Ready>("/ready");
  const audit = useApi<AuditEntry[]>("/audit?limit=40");
  const [verify, setVerify] = useState<Verify | null>(null);
  const [verr, setVerr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const runVerify = async () => {
    setBusy(true);
    try { setVerify(await api<Verify>("/audit/verify")); setVerr(null); } catch (e) { setVerr(e); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="System & audit" description="Service readiness and the tamper-evident audit chain of analyses and alerts." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Readiness">
          {ready.error ? <ErrorState error={ready.error} onRetry={ready.refresh} /> : !ready.data ? <Skeleton className="h-32" /> : (
            <div className="space-y-2 text-sm">
              {Object.entries(ready.data.checks).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-line pb-1.5">
                  <span className="text-ink-2">{k.replace(/_/g, " ")}</span>
                  {typeof v === "boolean"
                    ? v ? <span className="inline-flex items-center gap-1 text-status-good"><CheckCircle2 className="h-4 w-4" />ok</span> : <span className="inline-flex items-center gap-1 text-status-critical"><XCircle className="h-4 w-4" />unavailable</span>
                    : <span className="tabular-nums text-ink-1">{v}</span>}
                </div>
              ))}
              <div className="text-xs text-ink-3">environment {ready.data.environment} · model {ready.data.model_version}</div>
              {ready.data.errors.length > 0 && <ul className="list-disc pl-5 text-xs text-status-warning">{ready.data.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            </div>
          )}
        </Card>
        <Card title="Audit chain integrity" subtitle="Each entry stores SHA-256(previous hash ‖ entry). Editing or deleting any row breaks every later hash. Single-node and tamper-evident - not a distributed blockchain.">
          <div className="space-y-3">
            <Button onClick={runVerify} busy={busy}><Link2 className="h-4 w-4" /> Verify chain now</Button>
            {verr ? <ErrorState error={verr} /> : null}
            {verify && (
              <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${verify.valid ? "border-status-good/40 bg-status-good/10" : "border-status-critical/40 bg-status-critical/10"}`}>
                {verify.valid ? <CheckCircle2 className="h-5 w-5 text-status-good" /> : <ShieldAlert className="h-5 w-5 text-status-critical" />}
                <div>
                  <div className="text-ink-1">{verify.valid ? `Chain intact - ${verify.entries} entries verified.` : `Chain BROKEN at entry #${verify.broken_at_seq}.`}</div>
                  <div className="mt-1 break-all font-mono text-[10px] text-ink-3">head {verify.head}</div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
      <Card title="Latest audit entries" bodyClass="p-0">
        {audit.error ? <div className="p-3"><ErrorState error={audit.error} /></div> : !audit.data ? <div className="p-3"><Skeleton className="h-40" /></div> : audit.data.length === 0 ? (
          <EmptyState title="No audit entries yet" />
        ) : (
          <table className="w-full text-xs">
            <thead className="text-ink-3"><tr><th className="px-3 py-2 text-left font-normal">#</th><th className="py-2 text-left font-normal">event</th><th className="py-2 text-left font-normal">entity</th><th className="py-2 text-left font-normal">time</th><th className="px-3 py-2 text-left font-normal">hash</th></tr></thead>
            <tbody>
              {audit.data.map((e) => (
                <tr key={e.seq} className="border-t border-line">
                  <td className="px-3 py-1.5 tabular-nums text-ink-3">{e.seq}</td>
                  <td className="py-1.5 text-ink-1">{e.event_type}</td>
                  <td className="py-1.5 font-mono text-ink-3">{e.entity_id?.slice(0, 12)}</td>
                  <td className="py-1.5 text-ink-3">{fmtDateTime(e.created_at)}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-ink-3" title={`prev ${e.prev_hash}`}>{e.hash.slice(0, 20)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
