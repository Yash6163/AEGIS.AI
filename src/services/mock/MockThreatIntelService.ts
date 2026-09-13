import { IThreatIntelService } from '../contracts/IThreatIntelService';
import { ServiceResponse } from '@/types/common';
import { ThreatIntelligenceFeed, ThreatIndicator } from '@/types/threat-intel';
import { createMockMeta, mockThreatFeed, mockThreatIndicators } from './mockData';

export class MockThreatIntelService implements IThreatIntelService {
  private indicators: ThreatIndicator[] = [...mockThreatIndicators];

  async getThreatFeed(): Promise<ServiceResponse<ThreatIntelligenceFeed>> {
    return {
      success: true,
      data: {
        ...mockThreatFeed,
        indicators: [...this.indicators],
        totalIoCs: 48910 + this.indicators.length - mockThreatIndicators.length,
      },
      meta: createMockMeta(35),
    };
  }

  async getIndicators(filter?: {
    type?: string;
    stage?: string;
    tlp?: string;
    search?: string;
  }): Promise<ServiceResponse<ThreatIndicator[]>> {
    let result = [...this.indicators];

    if (filter?.type && filter.type !== 'ALL') {
      result = result.filter((i) => i.type.toLowerCase() === filter.type?.toLowerCase());
    }

    if (filter?.stage && filter.stage !== 'ALL') {
      result = result.filter((i) => i.attackStage.toLowerCase().includes(filter.stage!.toLowerCase()));
    }

    if (filter?.tlp && filter.tlp !== 'ALL') {
      result = result.filter((i) => i.tlp === filter.tlp);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (i) =>
          i.value.toLowerCase().includes(q) ||
          i.threatActor.toLowerCase().includes(q) ||
          i.mitreTechnique.toLowerCase().includes(q) ||
          i.sourceOrganization.toLowerCase().includes(q) ||
          i.threatFingerprint.toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      data: result,
      meta: createMockMeta(25),
    };
  }

  async shareIndicator(
    indicator: Omit<ThreatIndicator, 'id' | 'firstSeen' | 'verificationStatus'>
  ): Promise<ServiceResponse<ThreatIndicator>> {
    const newIndicator: ThreatIndicator = {
      ...indicator,
      id: `ioc-${Date.now().toString().slice(-4)}`,
      firstSeen: new Date().toISOString(),
      verificationStatus: 'PEER-VETTED',
    };

    this.indicators.unshift(newIndicator);

    return {
      success: true,
      data: newIndicator,
      meta: createMockMeta(45),
    };
  }
}
