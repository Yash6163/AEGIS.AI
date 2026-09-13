export type ThreatIndicatorType = 'ipv4' | 'domain' | 'hash' | 'cve' | 'pattern';
export type TlpLevel = 'WHITE' | 'GREEN' | 'AMBER' | 'RED';
export type ConsensusVerificationStatus = 'CONSENSUS-VERIFIED' | 'PEER-VETTED' | 'PENDING-QUORUM';

export interface ThreatIndicator {
  id: string;
  type: ThreatIndicatorType;
  value: string;
  threatActor: string;
  attackStage: string;
  mitreTechnique: string;
  threatFingerprint: string; // SHA-256 or JA3 fingerprint
  confidence: number; // 0 to 100
  sourceOrganization: string;
  verificationStatus: ConsensusVerificationStatus;
  firstSeen: string;
  lastObserved: string;
  tlp: TlpLevel;
  tags: string[];
  affectedSubnet?: string;
  evidenceHash?: string;
}

export interface ThreatIntelligenceFeed {
  totalIoCs: number;
  activeFeeds: number;
  participatingNodes: number;
  lastSyncTimestamp: string;
  peerConsensusRate: number;
  indicators: ThreatIndicator[];
}
