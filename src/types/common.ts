export type DataSourceMode = 'mock' | 'live';

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ServiceMeta {
  provider: string;
  isMock: boolean;
  timestamp: string;
  latencyMs: number;
  engineVersion: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data: T;
  meta: ServiceMeta;
  error?: string;
}

export interface SystemStatus {
  healthScore: number;
  engineStatus: 'ONLINE' | 'DEGRADED' | 'STANDBY';
  activeNodes: number;
  threatLevel: 'NOMINAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  ingestionRatePps: number;
  lastBlockVerified: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: ThreatSeverity;
  timestamp: string;
  read: boolean;
  category: 'prediction' | 'mitre' | 'blockchain' | 'network' | 'system';
  sourceIp?: string;
  targetIp?: string;
}
