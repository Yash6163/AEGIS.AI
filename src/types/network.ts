import { ThreatSeverity } from './common';

export type AttackStage =
  | 'Normal Baseline'
  | 'Reconnaissance'
  | 'Initial Access'
  | 'Execution'
  | 'Persistence'
  | 'Privilege Escalation'
  | 'Defense Evasion'
  | 'Credential Access'
  | 'Lateral Movement'
  | 'Command & Control'
  | 'Exfiltration'
  | 'Impact';

export interface NetworkFlow {
  id: string;
  timestamp: string;
  sourceIp: string;
  sourcePort: number;
  destIp: string;
  destPort: number;
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'HTTP' | 'TLS' | 'SMB';
  packetCount: number;
  byteCount: number;
  durationMs: number;
  synRate: number;
  isSuspicious: boolean;
  anomalyScore: number;
  threatType?: string;
  flags: string[];
}

export interface CurrentNetworkState {
  networkHealth: number; // 0 to 100%
  activeFlows: number;
  suspiciousFlows: number;
  currentRiskScore: number; // 0 to 100
  currentAttackStage: AttackStage;
  totalPacketsObserved: number;
  bandwidthMbps: number;
  synFloodRate: number;
  activeEndpoints: number;
  compromisedNodes: number;
}
