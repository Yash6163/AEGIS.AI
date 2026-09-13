import { INetworkService } from '../contracts/INetworkService';
import { ServiceResponse, SystemStatus } from '@/types/common';
import { CurrentNetworkState, NetworkFlow } from '@/types/network';
import { createMockMeta, mockNetworkState, mockSystemStatus } from './mockData';

export class MockNetworkService implements INetworkService {
  async getCurrentState(): Promise<ServiceResponse<CurrentNetworkState>> {
    return {
      success: true,
      data: { ...mockNetworkState },
      meta: createMockMeta(38),
    };
  }

  async getLiveFlows(limit = 10): Promise<ServiceResponse<NetworkFlow[]>> {
    const sampleFlows: NetworkFlow[] = [
      {
        id: 'flow-001',
        timestamp: new Date().toISOString(),
        sourceIp: '198.51.100.188',
        sourcePort: 49152,
        destIp: '10.240.12.4',
        destPort: 445,
        protocol: 'SMB',
        packetCount: 1420,
        byteCount: 894000,
        durationMs: 420,
        synRate: 480,
        isSuspicious: true,
        anomalyScore: 0.94,
        threatType: 'SMBv3 Compression Exploit',
        flags: ['SYN', 'ACK', 'PUSH', 'URG'],
      },
      {
        id: 'flow-002',
        timestamp: new Date().toISOString(),
        sourceIp: '203.0.113.45',
        sourcePort: 58210,
        destIp: '10.240.10.1',
        destPort: 80,
        protocol: 'HTTP',
        packetCount: 310,
        byteCount: 120500,
        durationMs: 1200,
        synRate: 35,
        isSuspicious: false,
        anomalyScore: 0.12,
        flags: ['ACK', 'FIN'],
      },
      {
        id: 'flow-003',
        timestamp: new Date().toISOString(),
        sourceIp: '198.51.100.74',
        sourcePort: 443,
        destIp: '10.240.14.88',
        destPort: 52190,
        protocol: 'TLS',
        packetCount: 88,
        byteCount: 42100,
        durationMs: 890,
        synRate: 15,
        isSuspicious: true,
        anomalyScore: 0.88,
        threatType: 'C2 Beaconing (JA3 Anomaly)',
        flags: ['SYN', 'ACK'],
      },
    ];

    return {
      success: true,
      data: sampleFlows.slice(0, limit),
      meta: createMockMeta(55),
    };
  }

  async getSystemStatus(): Promise<ServiceResponse<SystemStatus>> {
    return {
      success: true,
      data: { ...mockSystemStatus },
      meta: createMockMeta(24),
    };
  }
}
