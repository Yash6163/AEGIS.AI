import { ThreatSeverity } from './common';
import { AttackStage } from './network';

export interface FutureStateStep {
  step: number; // e.g. 0 for S(t), 1 for S(t+1), etc.
  stepLabel: string; // "S(t)", "S(t+1)", etc.
  relativeTimeMinutes: number; // e.g. +5 min, +15 min
  timestampWindow: string; // e.g. "17:25:00 (+5m)"
  predictedStage: AttackStage;
  riskScore: number; // 0 - 100
  infiltrationProbability: number; // 0 - 100%
  confidenceScore: number; // 0 - 100%
  transitionProbability: number; // 0.0 - 1.0 (P(S(t+k) | S(t+k-1)))
  severity: ThreatSeverity;
  importantFeatures: string[];
  vulnerableAsset: string;
  recommendedAction: string;
  entropyDivergence?: number;
}

export interface PredictionConfig {
  kSteps: number; // 1 to 8
  stepDurationMinutes: number; // e.g. 5 min
  modelVersion: string;
  confidenceThreshold: number; // 0 to 100
  modelType: 'TGNN + Temporal Attention' | 'Dual-LSTM + Markov' | 'Cyber-Mamba StateSpace';
}

export interface ModelMetadata {
  modelType: string;
  architectureDescription: string;
  stateRepresentation: string;
  trainingDataset: string;
  modelVersion: string;
  lastTrainedDate: string;
  mathematicalFormulation: string;
  inferenceLatencyMs: number;
}

export interface AttackPredictionSummary {
  predictionId: string;
  generatedAt: string;
  predictionHorizon: string; // e.g. "30 Minutes (K=5 Steps)"
  infiltrationProbability: number; // 0 - 100%
  overallRiskLevel: ThreatSeverity;
  confidenceScore: number; // 0 - 100%
  primaryAttackVector: string;
  targetSubnet: string;
  estimatedTimeToImpactMinutes: number;
  highestPredictedRisk: number;
  criticalStageETA: string;
  mostLikelyNextStage: AttackStage;
  futureStates: FutureStateStep[];
}

export interface TrajectoryStageNode {
  phase: 'Recon' | 'Initial Access' | 'Lateral Movement' | 'C2' | 'Exfiltration';
  status: 'passed' | 'active' | 'predicted' | 'potential';
  probability: number;
  estimatedTime: string;
  technique: string;
}
