import { ServiceResponse } from '@/types/common';
import {
  BlockchainEvidence,
  EvidenceRecordItem,
  ThreatEventItem,
  VerificationResult,
  WorkflowStageItem,
} from '@/types/blockchain';

export interface IBlockchainService {
  getLatestEvidence(): Promise<ServiceResponse<BlockchainEvidence>>;
  getEvidenceLedger(limit?: number): Promise<ServiceResponse<EvidenceRecordItem[]>>;
  getWorkflowStages(): Promise<ServiceResponse<WorkflowStageItem[]>>;
  verifyEvidence(hash: string): Promise<ServiceResponse<VerificationResult>>;
  verifyEvidenceHash(hash: string): Promise<ServiceResponse<{ isValid: boolean; verifiedAt: string; blockNumber: number }>>;
  getThreatEvents(limit?: number): Promise<ServiceResponse<ThreatEventItem[]>>;
}
