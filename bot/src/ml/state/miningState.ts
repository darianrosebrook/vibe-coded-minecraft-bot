import { Vec3 } from 'vec3';

export interface MineralDeposit {
  type: string;
  position: Vec3;
  size: number;
  density: number;
  depth: number;
  hardness: number;
  timestamp: number;
}

export interface MiningTool {
  type: string;
  efficiency: number;
  durability: number;
  enchantments: Array<{
    type: string;
    level: number;
  }>;
}

export interface MiningPath {
  waypoints: Vec3[];
  distance: number;
  efficiency: number;
  safety: number;
  resourceYield: {
    resource: number;
    quantity: number;
    efficiency: number;
    safety: number;
    timestamp: number;
  };
}

export interface MiningMLState {
  currentPosition: Vec3;
  targetResource?: string;
  targetDepth?: number;
  discoveredDeposits: MineralDeposit[];
  currentTool?: MiningTool;
  availableTools?: MiningTool[];
  currentPath?: MiningPath;
  performance?: {
    miningEfficiency: number;
    resourceDiscoveryRate: number;
    toolDurability: number;
  };
  performanceMetrics?: {
    miningEfficiency: number;
    resourceYieldRate: number;
    toolUsageEfficiency: number;
    pathOptimization: number;
  };
  safetyMetrics?: {
    proximityToHazards: number;
    structuralStability: number;
    oxygenLevel: number;
    lightLevel: number;
  };
  timestamp?: number;
}
