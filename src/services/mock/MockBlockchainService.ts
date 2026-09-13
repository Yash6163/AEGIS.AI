import { IBlockchainService } from '../contracts/IBlockchainService';
import { ServiceResponse } from '@/types/common';
import {
  BlockchainEvidence,
  EvidenceRecordItem,
  ThreatEventItem,
  VerificationResult,
  WorkflowStageItem,
} from '@/types/blockchain';
import {
  createMockMeta,
  mockBlockchainEvidence,
  mockEvidenceLedger,
  mockWorkflowStages,
  mockThreatEvents,
  mockVerificationReceipt,
} from './mockData';

/**
 * MockBlockchainService
 * 
 * Simulates decentralized state-anchoring for forensic and evidentiary compliance.
 * Architecture Note: To connect real Ethereum Sepolia, Hyperledger Besu, or a private EVM chain,
 * replace this implementation with Web3RpcBlockchainService implementing IBlockchainService.
 * Zero UI components will require modification.
 */
export class MockBlockchainService implements IBlockchainService {
  async getLatestEvidence(): Promise<ServiceResponse<BlockchainEvidence>> {
    return {
      success: true,
      data: { ...mockBlockchainEvidence },
      meta: createMockMeta(40),
    };
  }

  async getEvidenceLedger(limit = 10): Promise<ServiceResponse<EvidenceRecordItem[]>> {
    return {
      success: true,
      data: mockEvidenceLedger.slice(0, limit),
      meta: createMockMeta(45),
    };
  }

  async getWorkflowStages(): Promise<ServiceResponse<WorkflowStageItem[]>> {
    return {
      success: true,
      data: [...mockWorkflowStages],
      meta: createMockMeta(30),
    };
  }

  async verifyEvidence(hash: string): Promise<ServiceResponse<VerificationResult>> {
    const trimmed = hash.trim().toLowerCase();
    const matchingLedgerItem = mockEvidenceLedger.find(
      (item) => item.predictionHash.toLowerCase() === trimmed || item.transactionHash.toLowerCase() === trimmed
    );

    if (matchingLedgerItem) {
      return {
        success: true,
        data: {
          ...mockVerificationReceipt,
          blockNumber: matchingLedgerItem.blockNumber,
          transactionHash: matchingLedgerItem.transactionHash,
          merkleRoot: matchingLedgerItem.merkleRoot,
          auditSummary: `Record matches sealed block #${matchingLedgerItem.blockNumber}. Model ${matchingLedgerItem.modelVersion} digest confirmed.`,
          isSimulated: true,
          providerType: 'Mock-Besu-Simulation',
        },
        meta: createMockMeta(65),
      };
    }

    // Default simulation fallback
    const isMainHash = trimmed === mockBlockchainEvidence.predictionHash.toLowerCase();
    return {
      success: true,
      data: {
        ...mockVerificationReceipt,
        isValid: isMainHash || trimmed.startsWith('0x'),
        auditSummary: isMainHash
          ? 'Canonical prediction hash validated against Besu smart contract storage.'
          : 'Simulated heuristic verification: Hash verified against Merkle tree state.',
        isSimulated: true,
        providerType: 'Mock-Besu-Simulation',
      },
      meta: createMockMeta(70),
    };
  }

  async verifyEvidenceHash(hash: string): Promise<ServiceResponse<{ isValid: boolean; verifiedAt: string; blockNumber: number }>> {
    const result = await this.verifyEvidence(hash);
    return {
      success: true,
      data: {
        isValid: result.data.isValid,
        verifiedAt: result.data.verifiedAt,
        blockNumber: result.data.blockNumber,
      },
      meta: result.meta,
    };
  }

  async getThreatEvents(limit = 10): Promise<ServiceResponse<ThreatEventItem[]>> {
    return {
      success: true,
      data: mockThreatEvents.slice(0, limit),
      meta: createMockMeta(25),
    };
  }
}
