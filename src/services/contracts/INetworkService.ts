import { ServiceResponse, SystemStatus } from '@/types/common';
import { CurrentNetworkState, NetworkFlow } from '@/types/network';

export interface INetworkService {
  getCurrentState(): Promise<ServiceResponse<CurrentNetworkState>>;
  getLiveFlows(limit?: number): Promise<ServiceResponse<NetworkFlow[]>>;
  getSystemStatus(): Promise<ServiceResponse<SystemStatus>>;
}
