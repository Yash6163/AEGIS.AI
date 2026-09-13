import { ServiceResponse } from '@/types/common';
import {
  ExplainabilityReport,
  FeatureContribution,
  AttentionWeightItem,
  AnalystExplanation,
} from '@/types/explainability';

export interface IExplainabilityService {
  getReport(predictionId?: string): Promise<ServiceResponse<ExplainabilityReport>>;
  getFeatureContributions(predictionId?: string): Promise<ServiceResponse<FeatureContribution[]>>;
  getAttentionWeights(predictionId?: string): Promise<ServiceResponse<AttentionWeightItem[]>>;
  getAnalystExplanation(predictionId?: string): Promise<
    ServiceResponse<{
      current: AnalystExplanation;
      future: AnalystExplanation;
      statement: string;
    }>
  >;
  // Backwards compatibility alias
  getTopFeatures(predictionId?: string): Promise<ServiceResponse<any[]>>;
}
