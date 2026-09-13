export type EvidenceVerificationStatus = 'VERIFIED' | 'PENDING' | 'INVALID' | 'ANCHORED';

export interface WorkflowStageItem {
  step: number;
  name: string;
  shortDesc: string;
  fullDesc: string;
  status: 'completed' | 'active' | 'pending';
  outputData: string;
}

export interface EvidenceRecordItem {
  eventId: string;
  threatId: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  predictionHash: string;
  timestamp: string;
  infiltrationProbability: number;
  predictedAttackStage: string;
  topFeatures: string[];
  modelVersion: string;
  status: 'SEALED' | 'PROCESSED' | 'FLAGGED';
  evidenceStatus?: 'SEALED' | 'PROCESSED' | 'FLAGGED';
  verificationStatus: EvidenceVerificationStatus;
  smartContractAddress: string;
  consensusNetwork: string;
  merkleRoot: string;
  gasUsedOrProof: string;
  immutableRecordUrl?: string;
}

export interface BlockchainEvidence extends EvidenceRecordItem {
  evidenceId: string;
}

export interface VerificationResult {
  isValid: boolean;
  verifiedAt: string;
  blockNumber: number;
  transactionHash: string;
  merkleRoot: string;
  signerAddress: string;
  consensusMechanism: string;
  auditSummary: string;
  isSimulated: boolean;
  providerType: 'Mock-Besu-Simulation' | 'Ethereum-Sepolia' | 'Hyperledger-Fabric-RPC';
}

export interface ThreatEventItem {
  id: string;
  timestamp: string;
  event: string;
  sourceIp: string;
  destIp: string;
  attackStage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  actionTaken: 'Blocked' | 'Quarantined' | 'Alerted' | 'Simulated';
  blockchainTx: string;
}
