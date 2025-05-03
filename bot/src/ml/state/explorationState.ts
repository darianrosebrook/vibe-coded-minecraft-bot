import { Vec3 } from 'vec3';

export interface ResourceDistribution {
  type: string;
  position: Vec3;
  quantity: number;
  biome: string;
  depth: number;
  timestamp: number;
}

export interface BiomeTransition {
  fromBiome: string;
  toBiome: string;
  position: Vec3;
  distance: number;
  timestamp: number;
}

export interface ExplorationPath {
  waypoints: Vec3[];
  distance: number;
  resourceCount: number;
  biomeCount: number;
  efficiency: number;
}

export interface ExplorationMLState {
  currentPosition: Vec3;
  targetResource?: string;
  targetBiome?: string;
  discoveredResources: ResourceDistribution[];
  biomeTransitions: BiomeTransition[];
  currentPath?: ExplorationPath;
  performanceMetrics: {
    explorationEfficiency: number;
    resourceDiscoveryRate: number;
    biomeCoverage: number;
    pathOptimization: number;
  };
  timestamp: number;
} 