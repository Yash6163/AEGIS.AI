import { ServiceResponse } from '@/types/common';
import {
  AttackPredictionSummary,
  FutureStateStep,
  ModelMetadata,
  PredictionConfig,
  TrajectoryStageNode,
} from '@/types/prediction';
import { MitreAttackProgression, AttackPathDetails } from '@/types/mitre';

export interface IPredictionService {
  getLatestPrediction(): Promise<ServiceResponse<AttackPredictionSummary>>;
  getFutureTimeline(config?: number | Partial<PredictionConfig>): Promise<ServiceResponse<FutureStateStep[]>>;
  getMitreProgression(): Promise<ServiceResponse<MitreAttackProgression>>;
  getModelMetadata(): Promise<ServiceResponse<ModelMetadata>>;
  getAttackTrajectory(): Promise<ServiceResponse<TrajectoryStageNode[]>>;
  simulateKSteps(config: PredictionConfig): Promise<ServiceResponse<FutureStateStep[]>>;
  getAttackPathDetails(): Promise<ServiceResponse<AttackPathDetails>>;
}
