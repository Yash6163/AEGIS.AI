import { INetworkService } from './contracts/INetworkService';
import { IPredictionService } from './contracts/IPredictionService';
import { IExplainabilityService } from './contracts/IExplainabilityService';
import { IBlockchainService } from './contracts/IBlockchainService';
import { IThreatIntelService } from './contracts/IThreatIntelService';

import { MockNetworkService } from './mock/MockNetworkService';
import { MockPredictionService } from './mock/MockPredictionService';
import { MockExplainabilityService } from './mock/MockExplainabilityService';
import { MockBlockchainService } from './mock/MockBlockchainService';
import { MockThreatIntelService } from './mock/MockThreatIntelService';

// Service Registry / Factory
class ServiceContainer {
  private networkService: INetworkService;
  private predictionService: IPredictionService;
  private explainabilityService: IExplainabilityService;
  private blockchainService: IBlockchainService;
  private threatIntelService: IThreatIntelService;

  constructor() {
    // In production or when backend is available, these can switch to real API clients
    this.networkService = new MockNetworkService();
    this.predictionService = new MockPredictionService();
    this.explainabilityService = new MockExplainabilityService();
    this.blockchainService = new MockBlockchainService();
    this.threatIntelService = new MockThreatIntelService();
  }

  getNetworkService(): INetworkService {
    return this.networkService;
  }

  getPredictionService(): IPredictionService {
    return this.predictionService;
  }

  getExplainabilityService(): IExplainabilityService {
    return this.explainabilityService;
  }

  getBlockchainService(): IBlockchainService {
    return this.blockchainService;
  }

  getThreatIntelService(): IThreatIntelService {
    return this.threatIntelService;
  }
}

// Singleton export
export const services = new ServiceContainer();
