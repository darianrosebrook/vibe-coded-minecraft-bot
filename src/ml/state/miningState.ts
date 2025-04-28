import { Vec3 } from 'vec3';

export interface MiningMLState {
  resourceDistribution: {
    type: string;
    positions: Vec3[];
    quantities: number[];
    efficiency: number;
  };
  miningPath: {
    waypoints: Vec3[];
    distance: number;
    efficiency: number;
  };
  performance: {
    miningEfficiency: number;
    resourceDiscoveryRate: number;
    toolDurability: number;
  };
} 