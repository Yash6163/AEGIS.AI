import { ServiceResponse } from '@/types/common';
import { ThreatIntelligenceFeed, ThreatIndicator } from '@/types/threat-intel';

export interface IThreatIntelService {
  getThreatFeed(): Promise<ServiceResponse<ThreatIntelligenceFeed>>;
  getIndicators(filter?: {
    type?: string;
    stage?: string;
    tlp?: string;
    search?: string;
  }): Promise<ServiceResponse<ThreatIndicator[]>>;
  shareIndicator(indicator: Omit<ThreatIndicator, 'id' | 'firstSeen' | 'verificationStatus'>): Promise<ServiceResponse<ThreatIndicator>>;
}
