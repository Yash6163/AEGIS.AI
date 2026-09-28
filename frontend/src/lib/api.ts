/** Typed client for the backend (via the same-origin proxy at /api/backend). */

export const API_BASE = "/api/backend";

export class ApiError extends Error {
  constructor(public status: number, message: string, public requestId?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(0, "Network error - the frontend server is not reachable.");
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let rid: string | undefined;
    try {
      const body = await res.json();
      message = body?.error?.message ?? body?.detail ?? message;
      rid = body?.error?.request_id;
      if (body?.error?.details && Array.isArray(body.error.details)) {
        message += ": " + body.error.details.map((d: { msg?: string }) => d.msg).join("; ");
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, rid);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type StateName =
  | "NORMAL"
  | "RECONNAISSANCE"
  | "CREDENTIAL_ACCESS"
  | "EXPLOITATION"
  | "COMMAND_AND_CONTROL"
  | "INFILTRATION"
  | "IMPACT";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface HostSummary {
  host: string;
  role?: string | null;
  current_state: StateName;
  current_probability: number;
  next_state: StateName;
  next_probability: number;
  attack_probability: number;
  compromise_probability: number;
  risk_score: number;
  risk_level: RiskLevel;
  warning: boolean;
  truth_state?: StateName;
  stats?: Record<string, number>;
}

export interface NetworkSummary {
  risk_score: number;
  risk_level: RiskLevel;
  highest_risk_host: string;
  max_attack_probability: number;
  max_compromise_probability: number;
  hosts_warning: number;
  hosts_in_attack_state: number;
  hosts_total: number;
}

export interface Snapshot {
  scenario: string;
  t: number;
  n_windows: number;
  window_start: string;
  model: { version: string; mode: string; fold: number };
  early_warning: { horizon: number; threshold: number };
  history_padded: number;
  hosts: HostSummary[];
  network: NetworkSummary;
  data_label: string;
}

export interface StepForecast {
  step: number;
  state: StateName;
  probability: number;
  entropy: number;
  confidence_band: "HIGH" | "MEDIUM" | "UNCERTAIN";
  distribution: Record<StateName, number>;
}

export interface TreeNode {
  state: StateName | "OTHER";
  step: number;
  probability: number;
  conditional_probability: number;
  children: TreeNode[];
}

export interface Forecast {
  id?: string;
  model_version: string;
  horizon: number;
  window_seconds: number;
  history_windows: number;
  history_padded: number;
  mc_samples: number;
  current: { state: StateName; probability: number; distribution: Record<StateName, number> };
  steps: StepForecast[];
  risk: {
    risk_score: number;
    risk_level: RiskLevel;
    attack_probability: number;
    compromise_probability: number;
    expected_minutes_to_attack: number | null;
    expected_minutes_to_compromise: number | null;
    expected_peak_severity: number;
    current_severity: number;
    confidence: number;
    mc_standard_error: number;
    uncertain: boolean;
    uncertainty_reasons: string[];
  };
  early_warning: { horizon: number; probability: number; threshold: number; triggered: boolean };
  trajectory_tree: { depth: number; min_probability: number; roots: TreeNode[] };
  top_trajectories: { states: StateName[]; probability: number }[];
  ood: { score: number; flagged: boolean; meaning: string };
  explanation?: {
    method: string;
    target_state: StateName;
    target_probability: number;
    feature_contributions: { feature: string; description: string; contribution: number; attack_contribution: number }[];
    temporal_contributions: { minutes_ago: number; contribution: number }[];
    evidence: { feature: string; description: string; observed: number; training_mean: number; z_score: number }[];
  };
  ground_truth?: { states: (StateName | null)[]; available_steps: number; note: string };
  context?: Record<string, unknown>;
  latency_ms: number;
}

export interface ScenarioMeta {
  id: string;
  day: string;
  title: string;
  description: string;
  start: string;
  window_seconds: number;
  n_windows: number;
  hosts: { host: string; role: string | null }[];
  attack_minutes: Record<string, number>;
}

export interface ScenarioDetail extends ScenarioMeta {
  episodes: { host: string; state: StateName; start_index: number; minutes: number }[];
  timeline: { flows: number[]; truth: (StateName | null)[][] };
}

export interface Alert {
  id: string;
  created_at: string;
  updated_at: string | null;
  source: string;
  context: string | null;
  host: string;
  window_start: string | null;
  level: RiskLevel;
  status: "open" | "acknowledged" | "resolved";
  title: string;
  predicted_state: StateName;
  current_state: StateName;
  attack_probability: number;
  compromise_probability: number;
  risk_score: number;
  horizon: number;
  model_version: string;
  forecast_id: string | null;
  note: string | null;
}

export interface Job {
  id: string;
  created_at: string;
  finished_at: string | null;
  status: "queued" | "running" | "completed" | "failed";
  filename: string;
  file_sha256: string;
  size_bytes: number;
  anonymized: boolean;
  internal_networks: string;
  model_version: string | null;
  n_flows: number | null;
  n_hosts: number | null;
  n_windows: number | null;
  start_time: string | null;
  end_time: string | null;
  warnings: string[];
  error: string | null;
  has_labels: boolean;
}

export interface AuditEntry {
  seq: number;
  created_at: string;
  event_type: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
}
