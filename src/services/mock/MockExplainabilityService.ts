import { IExplainabilityService } from '../contracts/IExplainabilityService';
import { ServiceResponse } from '@/types/common';
import {
  ExplainabilityReport,
  FeatureContribution,
  AttentionWeightItem,
  AnalystExplanation,
} from '@/types/explainability';
import {
  createMockMeta,
  mockExplainabilityReport,
  mockFeatureContributions,
  mockAttentionWeights,
  mockCurrentExplanation,
  mockFutureExplanation,
  mockAnalystStatement,
} from './mockData';

export class MockExplainabilityService implements IExplainabilityService {
  async getReport(predictionId?: string): Promise<ServiceResponse<ExplainabilityReport>> {
    return {
      success: true,
      data: { ...mockExplainabilityReport },
      meta: createMockMeta(55),
    };
  }

  async getFeatureContributions(predictionId?: string): Promise<ServiceResponse<FeatureContribution[]>> {
    return {
      success: true,
      data: [...mockFeatureContributions],
      meta: createMockMeta(38),
    };
  }

  async getAttentionWeights(predictionId?: string): Promise<ServiceResponse<AttentionWeightItem[]>> {
    return {
      success: true,
      data: [...mockAttentionWeights],
      meta: createMockMeta(42),
    };
  }

  async getAnalystExplanation(predictionId?: string): Promise<
    ServiceResponse<{
      current: AnalystExplanation;
      future: AnalystExplanation;
      statement: string;
    }>
  > {
    return {
      success: true,
      data: {
        current: mockCurrentExplanation,
        future: mockFutureExplanation,
        statement: mockAnalystStatement,
      },
      meta: createMockMeta(35),
    };
  }

  // Backwards compatibility alias for dashboard
  async getTopFeatures(predictionId?: string): Promise<ServiceResponse<any[]>> {
    return {
      success: true,
      data: [...mockFeatureContributions],
      meta: createMockMeta(30),
    };
  }
}
