"use client";

import { FileUp, Upload } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { Button, Card, EmptyState, ErrorState, Pill, Skeleton, useApi, useToast } from "@/components/ui";
import { type Job, api } from "@/lib/api";
import { compact, fmtDateTime } from "@/lib/states";

const MAX_MB = 50;

export default function AnalysisPage() {
  const toast = useToast();
  const jobs = useApi<Job[]>("/analysis/jobs?limit=30");
  const [file, setFile] = useState<File | null>(null);
  const [networks, setNetworks] = useState("192.168.0.0/16,10.0.0.0/8,172.16.0.0/12");
  const [anonymize, setAnonymize] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = jobs.data?.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(jobs.refresh, 2000);
    return () => clearInterval(id);
  }, [pending, jobs.refresh]);

  const validate = (f: File | null): string | null => {
    if (!f) return "Choose a file first.";
    if (!/\.(csv|csv\.gz|binetflow|pcap|pcap\.gz|cap)$/i.test(f.name)) return "Accepted: flow CSV (.csv, .csv.gz, .binetflow) or libpcap capture (.pcap, .pcap.gz).";
    if (f.size > MAX_MB * 1024 * 1024) return `File is larger than ${MAX_MB} MB.`;
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate(file);
    if (problem) { setErr(new Error(problem)); return; }
    const fd = new FormData();
    fd.append("file", file!);
    fd.append("internal_networks", networks);
    fd.append("anonymize", String(anonymize));
    setBusy(true); setErr(null);
    try {
      const job = await api<Job>("/analysis/upload", { method: "POST", body: fd });
      toast(`Upload accepted - analysing ${job.filename}`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      jobs.refresh();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Traffic analysis"
        description="Upload flow records or a packet capture. Flows are grouped per internal host and per minute, every host-minute is forecast, and alerts are raised where the early-warning condition starts." />
      <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Card title="Upload traffic" subtitle={`Max ${MAX_MB} MB. Format is detected automatically: CICFlowMeter CSV -> CIC model (37 features); Argus/CTU-13 binetflow, UNSW-NB15 CSV or libpcap .pcap -> multi-dataset portable model (26 features). Label columns are used only for comparison.`}>
          <form onSubmit={submit} className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface-0 px-4 py-6 text-center hover:border-accent/60">
              <FileUp className="h-6 w-6 text-ink-3" aria-hidden />
              <span className="text-sm text-ink-1">{file ? file.name : "Choose a flow file or .pcap"}</span>
              <span className="text-xs text-ink-3">{file ? `${(file.size / 1048576).toFixed(1)} MB` : "never executed; parsed as data only"}</span>
              <input ref={inputRef} type="file" accept=".csv,.gz,.binetflow,.pcap,.cap,text/csv,application/gzip,application/vnd.tcpdump.pcap" className="sr-only"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(null); }} />
            </label>
            <div>
              <label htmlFor="nets" className="text-xs text-ink-3">Internal networks (hosts to forecast)</label>
              <input id="nets" value={networks} onChange={(e) => setNetworks(e.target.value)} maxLength={500}
                className="mt-1 w-full rounded-md border border-line-strong bg-surface-2 px-2 py-1.5 font-mono text-xs text-ink-1" />
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} />
              Pseudonymise host IPs before storing (HMAC)
            </label>
            {err ? <ErrorState error={err} /> : null}
            <Button type="submit" variant="primary" busy={busy} disabled={!file}><Upload className="h-4 w-4" /> Analyse</Button>
          </form>
          <p className="mt-3 text-[11px] text-ink-3">
            Only aggregate per-minute features are stored, never raw flows. A sample file can be generated with <code className="text-ink-2">python ml/make_sample.py</code>.
            Traffic from networks unlike CIC-IDS2017 will be flagged as out-of-distribution.
          </p>
        </Card>

        <Card title="Analyses" bodyClass="p-0">
          {jobs.error ? <div className="p-3"><ErrorState error={jobs.error} onRetry={jobs.refresh} /></div> : !jobs.data ? (
            <div className="space-y-2 p-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : jobs.data.length === 0 ? <EmptyState title="No analyses yet">Upload a flow file to start.</EmptyState> : (
            <table className="w-full text-xs">
              <thead className="text-ink-3"><tr>
                <th className="px-3 py-2 text-left font-normal">file</th><th className="py-2 text-left font-normal">status</th>
                <th className="py-2 text-right font-normal">flows</th><th className="py-2 text-right font-normal">hosts</th>
                <th className="py-2 text-right font-normal">minutes</th><th className="px-3 py-2 text-right font-normal">submitted</th>
              </tr></thead>
              <tbody>
                {jobs.data.map((j) => (
                  <tr key={j.id} className="border-t border-line hover:bg-surface-2">
                    <td className="px-3 py-2">
                      {j.status === "completed" ? <Link href={`/analysis/${j.id}`} className="text-accent hover:underline">{j.filename}</Link> : <span className="text-ink-1">{j.filename}</span>}
                      <div className="font-mono text-[10px] text-ink-3" title={j.file_sha256}>sha256 {j.file_sha256.slice(0, 12)}…</div>
                      {j.error && <div className="text-[11px] text-status-critical">{j.error}</div>}
                    </td>
                    <td className="py-2"><Pill tone={j.status === "failed" ? "warn" : j.status === "completed" ? "neutral" : "info"}>{j.status}</Pill></td>
                    <td className="py-2 text-right tabular-nums">{j.n_flows ? compact(j.n_flows) : "-"}</td>
                    <td className="py-2 text-right tabular-nums">{j.n_hosts ?? "-"}</td>
                    <td className="py-2 text-right tabular-nums">{j.n_windows ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-ink-3">{fmtDateTime(j.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
