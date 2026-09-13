export type MitrePhase =
  | 'Reconnaissance'
  | 'Initial Access'
  | 'Execution'
  | 'Persistence'
  | 'Lateral Movement'
  | 'Command & Control'
  | 'Exfiltration';

export interface MitreStageNode {
  phase: MitrePhase;
  techniqueId: string;
  techniqueName: string;
  status: 'passed' | 'current' | 'predicted' | 'potential';
  probability: number;
  confidence: number;
  stepIndex: number;
  evidenceCount: number;
  description: string;
  transitionProbability?: number; // P(Stage_k | Stage_k-1)
  estimatedTime?: string;
  targetHostId?: string;
}

export interface NetworkDeviceNode {
  id: string;
  name: string;
  ip: string;
  subnet: string;
  role: string;
  status: 'compromised' | 'targeted' | 'at_risk' | 'secure';
  openPorts: number[];
  os: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  compromiseStage?: MitrePhase;
  containmentStatus: 'NORMAL' | 'ISOLATED' | 'SCRUBBED';
  x: number; // 2D layout coordinates for SVG topology
  y: number;
}

export interface CommunicationLink {
  id: string;
  sourceId: string;
  targetId: string;
  protocol: 'SMB' | 'TCP' | 'HTTP' | 'TLS' | 'DNS' | 'RPC';
  port: number;
  isSuspicious: boolean;
  threatType?: string;
  packetRatePps: number;
  bandwidthKbps: number;
  confidence: number;
  lastActive: string;
}

export interface AttackPathDetails {
  chainId: string;
  threatActorGroup: string;
  currentAttackerPosition: {
    stage: MitrePhase;
    hostId: string;
    hostName: string;
    hostIp: string;
    timeOnNode: string;
  };
  stages: MitreStageNode[];
  devices: NetworkDeviceNode[];
  links: CommunicationLink[];
  recommendations: {
    immediateAction: string;
    affectedSubnet: string;
    automatedIsolationRule: string;
  };
}

export interface MitreAttackProgression {
  chainId: string;
  threatActorGroup: string;
  currentStage: MitrePhase;
  predictedNextStage: MitrePhase;
  progressionSpeed: 'Slow' | 'Moderate' | 'Rapid' | 'Imminent';
  stages: MitreStageNode[];
}
