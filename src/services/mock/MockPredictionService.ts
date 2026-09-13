import { IPredictionService } from '../contracts/IPredictionService';
import { ServiceResponse } from '@/types/common';
import {
  AttackPredictionSummary,
  FutureStateStep,
  ModelMetadata,
  PredictionConfig,
  TrajectoryStageNode,
} from '@/types/prediction';
import { MitreAttackProgression, AttackPathDetails } from '@/types/mitre';
import {
  createMockMeta,
  mockFutureSteps,
  mockMitreProgression,
  mockPredictionSummary,
  mockModelMetadata,
  mockAttackTrajectory,
  mockAttackPathDetails,
} from './mockData';

export class MockPredictionService implements IPredictionService {
  async getLatestPrediction(): Promise<ServiceResponse<AttackPredictionSummary>> {
    return {
      success: true,
      data: { ...mockPredictionSummary },
      meta: createMockMeta(62),
    };
  }

  async getFutureTimeline(config?: number | Partial<PredictionConfig>): Promise<ServiceResponse<FutureStateStep[]>> {
    const k = typeof config === 'number' ? config : (config?.kSteps ?? 5);
    return {
      success: true,
      data: mockFutureSteps.slice(0, k + 1),
      meta: createMockMeta(48),
    };
  }

  async getMitreProgression(): Promise<ServiceResponse<MitreAttackProgression>> {
    return {
      success: true,
      data: { ...mockMitreProgression },
      meta: createMockMeta(52),
    };
  }

  async getModelMetadata(): Promise<ServiceResponse<ModelMetadata>> {
    return {
      success: true,
      data: { ...mockModelMetadata },
      meta: createMockMeta(28),
    };
  }

  async getAttackTrajectory(): Promise<ServiceResponse<TrajectoryStageNode[]>> {
    return {
      success: true,
      data: [...mockAttackTrajectory],
      meta: createMockMeta(32),
    };
  }

  async simulateKSteps(config: PredictionConfig): Promise<ServiceResponse<FutureStateStep[]>> {
    // Generate dynamically scaled steps matching K
    const k = Math.min(Math.max(config.kSteps, 1), 8);
    const simulatedSteps: FutureStateStep[] = [];

    // Base template
    for (let i = 0; i <= k; i++) {
      if (i < mockFutureSteps.length) {
        const base = mockFutureSteps[i];
        // Apply confidence threshold factor
        const confRatio = config.confidenceThreshold / 90;
        const adjustedRisk = Math.min(Math.round(base.riskScore * confRatio), 100);
        simulatedSteps.push({
          ...base,
          step: i,
          stepLabel: i === 0 ? 'S(t)' : i === k ? 'S(t+K)' : `S(t+${i})`,
          relativeTimeMinutes: i * config.stepDurationMinutes,
          timestampWindow: `+${i * config.stepDurationMinutes}m Window`,
          riskScore: adjustedRisk,
        });
      } else {
        // Synthesize for k > 5
        const timeOffset = i * config.stepDurationMinutes;
        simulatedSteps.push({
          step: i,
          stepLabel: i === k ? 'S(t+K)' : `S(t+${i})`,
          relativeTimeMinutes: timeOffset,
          timestampWindow: `+${timeOffset}m Window`,
          predictedStage: 'Exfiltration',
          riskScore: Math.min(95 + i, 100),
          infiltrationProbability: 98.5,
          confidenceScore: 74.0,
          transitionProbability: 0.60,
          severity: 'critical',
          importantFeatures: ['Total subnet compromise', 'Active egress tunnel', 'Kerberos golden ticket usage'],
          vulnerableAsset: 'Enterprise Domain Controller Tier 0',
          recommendedAction: 'Engage full disaster recovery airgap sequence',
          entropyDivergence: 9.1,
        });
      }
    }

    return {
      success: true,
      data: simulatedSteps,
      meta: createMockMeta(75),
    };
  }

  async getAttackPathDetails(): Promise<ServiceResponse<AttackPathDetails>> {
    return {
      success: true,
      data: { ...mockAttackPathDetails },
      meta: createMockMeta(45),
    };
  }
}
