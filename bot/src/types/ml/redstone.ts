import { Vec3 } from 'vec3';

/**
 * Represents the state of a single redstone device in the Minecraft world.
 * This type is used to track and manage individual redstone components.
 */
export interface RedstoneDeviceState {
  /** The type of redstone device (e.g., lever, button, pressure plate) */
  type: 'lever' | 'button' | 'pressure_plate' | 'redstone_torch' | 'redstone_block' | 'repeater' | 'comparator';
  /** The position of the device in the world */
  position: Vec3;
  /** Whether the device is currently powered/activated */
  state: boolean;
  /** The current power level of the device (0-15) */
  powerLevel: number;
  /** For repeaters: the delay setting (1-4 ticks) */
  delay?: number;
  /** For comparators: the comparison mode */
  compareMode?: 'subtract' | 'compare';
}

/**
 * Represents the complete state of a redstone circuit, including all devices
 * and their connections. Used for circuit analysis and optimization.
 */
export interface RedstoneCircuitState {
  /** Array of all redstone devices in the circuit */
  devices: RedstoneDeviceState[];
  /** Array of connections between devices, using indices from the devices array */
  connections: Array<{ from: number; to: number }>;
  /** Array of power flow paths with their current power levels */
  powerFlow: Array<{ from: number; to: number; power: number }>;
  /** How often the circuit state is updated (in ticks) */
  updateInterval: number;
  /** Circuit efficiency metric (0-1) */
  efficiency: number;
}

/**
 * Represents the state of an automated farm that uses redstone for control.
 * Tracks both the farm's physical layout and its redstone control system.
 */
export interface FarmState {
  /** Types of crops being grown in the farm */
  cropTypes: string[];
  /** The area where crops are grown, defined by two corner points */
  harvestArea: {
    start: Vec3;
    end: Vec3;
  };
  /** Positions of water sources in the farm */
  waterSources: Vec3[];
  /** Optional redstone control device for the farm */
  redstoneControl?: RedstoneDeviceState;
  /** How often the farm state is checked (in ticks) */
  checkInterval: number;
  /** Average growth rate of crops (0-1) */
  growthRate: number;
  /** Percentage of farm area covered by water (0-1) */
  waterCoverage: number;
  /** Overall farm efficiency metric (0-1) */
  efficiency: number;
}

/**
 * Represents the complete state of the redstone ML system, including
 * circuit states, farm states, and performance metrics. This is the
 * primary type used for ML training and analysis.
 */
export interface RedstoneMLState {
  /** The current state of the redstone circuit being monitored */
  circuitState: RedstoneCircuitState;
  /** Optional farm state if the circuit controls a farm */
  farmState?: FarmState;
  /** Timestamp of when this state was recorded */
  timestamp: number;
  /** Various performance metrics for the redstone system */
  performanceMetrics: {
    /** How efficiently power is used in the circuit (0-1) */
    powerEfficiency: number;
    /** Complexity score of the circuit (0-1) */
    circuitComplexity: number;
    /** How often the circuit updates (ticks) */
    updateFrequency: number;
    /** Resource usage score (0-1) */
    resourceUsage: number;
  };
} 