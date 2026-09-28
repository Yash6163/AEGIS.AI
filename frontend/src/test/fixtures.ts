import type { Forecast, StateName } from "@/lib/api";

const dist = (p: Partial<Record<StateName, number>>) => ({
  NORMAL: 0, RECONNAISSANCE: 0, CREDENTIAL_ACCESS: 0, EXPLOITATION: 0, COMMAND_AND_CONTROL: 0, INFILTRATION: 0, IMPACT: 0, ...p,
});

export const forecast: Forecast = {
  model_version: "aegis-wm-test",
  horizon: 2,
  window_seconds: 60,
  history_windows: 10,
  history_padded: 0,
  mc_samples: 512,
  current: { state: "NORMAL", probability: 0.7, distribution: dist({ NORMAL: 0.7, CREDENTIAL_ACCESS: 0.3 }) },
  steps: [
    { step: 0, state: "NORMAL", probability: 0.7, entropy: 0.3, confidence_band: "MEDIUM", distribution: dist({ NORMAL: 0.7, CREDENTIAL_ACCESS: 0.3 }) },
    { step: 1, state: "CREDENTIAL_ACCESS", probability: 0.45, entropy: 0.7, confidence_band: "UNCERTAIN", distribution: dist({ NORMAL: 0.4, CREDENTIAL_ACCESS: 0.45, EXPLOITATION: 0.15 }) },
    { step: 2, state: "CREDENTIAL_ACCESS", probability: 0.6, entropy: 0.5, confidence_band: "MEDIUM", distribution: dist({ NORMAL: 0.3, CREDENTIAL_ACCESS: 0.6, EXPLOITATION: 0.1 }) },
  ],
  risk: {
    risk_score: 52, risk_level: "HIGH", attack_probability: 0.64, compromise_probability: 0.18,
    expected_minutes_to_attack: 1.2, expected_minutes_to_compromise: 2, expected_peak_severity: 0.52, current_severity: 0.1,
    confidence: 0.41, mc_standard_error: 0.02, uncertain: true, uncertainty_reasons: ["next-minute state distribution is diffuse"],
  },
  early_warning: { horizon: 5, probability: 0.7, threshold: 0.5, triggered: true },
  trajectory_tree: {
    depth: 2, min_probability: 0.03,
    roots: [{ state: "NORMAL", step: 0, probability: 0.7, conditional_probability: 0.7, children: [
      { state: "CREDENTIAL_ACCESS", step: 1, probability: 0.4, conditional_probability: 0.57, children: [] },
      { state: "NORMAL", step: 1, probability: 0.3, conditional_probability: 0.43, children: [] },
    ] }, { state: "CREDENTIAL_ACCESS", step: 0, probability: 0.3, conditional_probability: 0.3, children: [] }],
  },
  top_trajectories: [{ states: ["NORMAL", "CREDENTIAL_ACCESS", "CREDENTIAL_ACCESS"], probability: 0.3 }],
  ood: { score: 0.4, flagged: false, meaning: "" },
  ground_truth: { states: ["NORMAL", "CREDENTIAL_ACCESS", "CREDENTIAL_ACCESS"], available_steps: 3, note: "" },
  latency_ms: 12,
};
