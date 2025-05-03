import { Vec3 } from 'vec3';

export interface RedstoneDeviceState {
  type: 'lever' | 'button' | 'pressure_plate' | 'redstone_torch' | 'redstone_block' | 'repeater' | 'comparator';
  position: Vec3;
  state: boolean;
  powerLevel: number;
  delay?: number;
  compareMode?: 'subtract' | 'compare';
}

export interface RedstoneCircuitState {
  devices: RedstoneDeviceState[];
  connections: Array<{ from: number; to: number }>;
  powerFlow: Array<{ from: number; to: number; power: number }>;
  updateInterval: number;
  efficiency: number;
}

export interface FarmState {
  cropTypes: string[];
  harvestArea: {
    start: Vec3;
    end: Vec3;
  };
  waterSources: Vec3[];
  redstoneControl?: RedstoneDeviceState;
  checkInterval: number;
  growthRate: number;
  waterCoverage: number;
  efficiency: number;
}

export interface RedstoneMLState {
  circuitState: RedstoneCircuitState;
  farmState?: FarmState;
  timestamp: number;
  performanceMetrics: {
    powerEfficiency: number;
    circuitComplexity: number;
    updateFrequency: number;
    resourceUsage: number;
  };
} 