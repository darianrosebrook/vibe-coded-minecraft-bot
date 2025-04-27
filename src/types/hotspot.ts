import { Vec3 } from './common';

export interface ResourceData {
  position: Vec3;
  blockType: string;
  yieldValue: number;
  timestamp: number;
}

export interface Hotspot {
  resourceType: string;
  center: Vec3;
  radius: number;
  averageYield: number;
  lastUpdated: number;
  resourceCount: number;
}

export interface HotspotMetrics {
  totalHotspots: number;
  averageYield: number;
  resourceDistribution: Record<string, number>;
  updateFrequency: number;
  accuracy: number;
}

export interface HotspotConfig {
  minRadius: number;
  maxRadius: number;
  minResources: number;
  yieldThreshold: number;
  updateInterval: number;
  decayRate: number;
} 