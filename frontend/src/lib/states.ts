import type { RiskLevel, StateName } from "./api";

/**
 * Attack-state identity colours: the validated dark-mode categorical slots
 * (dataviz reference palette, adjacent CVD dE >= 8.4), assigned in fixed order.
 * NORMAL is neutral gray, not a hue. Identity is never colour-alone: every
 * chart also labels states in text.
 */
export const STATE_ORDER: StateName[] = [
  "NORMAL",
  "RECONNAISSANCE",
  "CREDENTIAL_ACCESS",
  "EXPLOITATION",
  "COMMAND_AND_CONTROL",
  "INFILTRATION",
  "IMPACT",
];

export const STATE_COLOR: Record<StateName | "OTHER", string> = {
  NORMAL: "#5f5e58",
  RECONNAISSANCE: "#3987e5",
  CREDENTIAL_ACCESS: "#d95926",
  EXPLOITATION: "#199e70",
  COMMAND_AND_CONTROL: "#c98500",
  INFILTRATION: "#d55181",
  IMPACT: "#9085e9",
  OTHER: "#3a3a36",
};

export const STATE_LABEL: Record<StateName | "OTHER", string> = {
  NORMAL: "Normal",
  RECONNAISSANCE: "Reconnaissance",
  CREDENTIAL_ACCESS: "Credential access",
  EXPLOITATION: "Exploitation",
  COMMAND_AND_CONTROL: "Command & control",
  INFILTRATION: "Infiltration",
  IMPACT: "Impact (DoS)",
  OTHER: "Other (<3%)",
};

export const STATE_SHORT: Record<StateName | "OTHER", string> = {
  NORMAL: "NORM",
  RECONNAISSANCE: "RECON",
  CREDENTIAL_ACCESS: "CRED",
  EXPLOITATION: "EXPL",
  COMMAND_AND_CONTROL: "C2",
  INFILTRATION: "INFIL",
  IMPACT: "IMPACT",
  OTHER: "OTHER",
};

/** Risk levels use the reserved status palette, always with an icon + label. */
export const RISK_COLOR: Record<RiskLevel, string> = {
  LOW: "#0ca30c",
  MEDIUM: "#fab219",
  HIGH: "#ec835a",
  CRITICAL: "#d03b3b",
};

export const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "-" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "-" : v.toFixed(digits);

export const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toISOString().slice(11, 16) + " UTC" : "-";

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "-";

export const compact = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(1)}G` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : `${v}`;
