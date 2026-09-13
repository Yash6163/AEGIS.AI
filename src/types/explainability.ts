export interface FeatureContribution {
  id: string;
  featureName: string;
  category: 'flow' | 'transport' | 'temporal' | 'payload' | 'protocol';
  contributionScore: number; // e.g. -100 to +100 or 0 to 100
  shapValue: number; // raw SHAP attribution value e.g. +0.482, -0.114
  direction: 'positive' | 'negative'; // positive increases attack probability, negative decreases
  observedValue: string;
  baselineValue: string;
  unit?: string;
  impactWeight?: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  rationale?: string;
}

export type TopFeatureContribution = FeatureContribution;

export interface AttentionWeightItem {
  headId: number;
  temporalWindow: string; // e.g. "t-2", "t-1", "t (Now)", "t+1"
  sourceEntity: string;
  targetEntity: string;
  weight: number; // 0.0 to 1.0
  interpretation: string;
}

export interface AnalystExplanation {
  headline: string;
  summary: string;
  primaryDrivers: string[];
  currentPostureInsight: string;
  futureProgressionInsight: string;
  triagePlaybook: string;
  riskRating: 'NOMINAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
}

export interface ExplainabilityReport {
  predictionId: string;
  methodology: 'SHAP (KernelExplainer)' | 'LIME' | 'Integrated Gradients';
  modelVersion: string;
  baselineComparison: string;
  baseRateRisk: number; // e.g. 15%
  predictedRisk: number; // e.g. 86.4%
  features: FeatureContribution[];
  attentionWeights: AttentionWeightItem[];
  currentStateExplanation: AnalystExplanation;
  futurePredictionExplanation: AnalystExplanation;
  analystSummaryStatement: string;
  summaryNote?: string;
  topFeatures?: FeatureContribution[]; // for backwards compatibility
}
