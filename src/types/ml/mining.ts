import { Vec3 } from 'vec3';

/**
 * Machine Learning Mining Types
 * 
 * This module defines types for ML-powered mining operations.
 * These types handle mining patterns, efficiency tracking, and resource prediction.
 * 
 * @module MLMining
 */

/**
 * Mining prediction interface
 */
export interface MiningPrediction {
  targetBlock: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  confidence: number;
  yieldPrediction: number;
  riskAssessment: {
    lava: number;
    water: number;
    mobs: number;
    fall: number;
  };
  efficiency: number;
  recommendedTool?: string;
  alternativeLocations?: Array<{
    position: { x: number; y: number; z: number };
    confidence: number;
    distance: number;
  }>;
}

/**
 * Mining pattern interface
 */
export interface MiningPattern {
  type: 'strip' | 'branch' | 'spiral' | 'custom';
  parameters: {
    width?: number;
    height?: number;
    depth?: number;
    spacing?: number;
    direction?: 'north' | 'south' | 'east' | 'west';
  };
  efficiency: number;
  safety: number;
  resourceYield: number;
  recommendedFor: string[];
}

/**
 * Mining efficiency metrics
 */
export interface MiningEfficiency {
  blocksPerMinute: number;
  toolDurability: number;
  energyUsage: number;
  resourceYield: number;
  wastePercentage: number;
  timePerBlock: number;
  pathEfficiency: number;
}

/**
 * Mining risk assessment
 */
export interface MiningRisk {
  position: { x: number; y: number; z: number };
  hazards: Array<{
    type: 'lava' | 'water' | 'mob' | 'fall' | 'cave-in';
    probability: number;
    severity: number;
    mitigation?: string;
  }>;
  overallRisk: number;
  recommendedActions: string[];
}

/**
 * Mining resource prediction
 */
export interface ResourcePrediction {
  blockType: string;
  position: { x: number; y: number; z: number };
  quantity: number;
  confidence: number;
  biome: string;
  depth: number;
  surroundingBlocks: Array<{
    type: string;
    position: { x: number; y: number; z: number };
    relevance: number;
  }>;
}

/**
 * Mining path optimization
 */
export interface MiningPath {
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  waypoints: Array<{
    position: { x: number; y: number; z: number };
    action: 'mine' | 'move' | 'place' | 'use';
    blockType?: string;
  }>;
  efficiency: number;
  safety: number;
  estimatedTime: number;
  resourceYield: number;
}

/**
 * Mining inventory management
 */
export interface MiningInventory {
  tools: Array<{
    type: string;
    durability: number;
    efficiency: number;
    suitability: Record<string, number>;
  }>;
  blocks: Array<{
    type: string;
    quantity: number;
    priority: number;
  }>;
  capacity: {
    current: number;
    max: number;
    utilization: number;
  };
}

/**
 * Mining performance metrics
 */
export interface MiningPerformance {
  session: {
    startTime: number;
    duration: number;
    blocksMined: number;
    resourcesGathered: Record<string, number>;
    efficiency: number;
  };
  recent: {
    blocksPerMinute: number;
    toolUsage: number;
    pathEfficiency: number;
    riskExposure: number;
  };
  historical: {
    averageEfficiency: number;
    bestPattern: string;
    commonIssues: Array<{
      type: string;
      frequency: number;
      impact: number;
    }>;
  };
}

/**
 * Mining state interface
 */
export interface MiningState {
  currentTask: {
    target: string;
    position: { x: number; y: number; z: number };
    progress: number;
    status: 'planning' | 'executing' | 'paused' | 'completed';
  };
  environment: {
    biome: string;
    lightLevel: number;
    nearbyEntities: Array<{
      type: string;
      position: { x: number; y: number; z: number };
      distance: number;
    }>;
  };
  predictions: {
    nextBlock?: MiningPrediction;
    path?: MiningPath;
    risks?: MiningRisk;
  };
  performance: MiningPerformance;
}

/**
 * Consolidated MiningMLState interface that combines all mining-related state information
 * for machine learning operations.
 */
export interface MiningMLState {
  // Resource tracking
  resourceDistribution: {
    type: string;
    positions: Vec3[];
    quantities: number[];
    efficiency: number;
  };
  
  // Current mining target
  targetBlock?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  
  // Environment information
  surroundingBlocks?: Array<{
    type: string;
    position: {
      x: number;
      y: number;
      z: number;
    };
  }>;
  biome?: string;
  lightLevel?: number;
  
  // Mining path and navigation
  miningPath: {
    waypoints: Vec3[];
    distance: number;
    efficiency: number;
  };
  
  // Tool and equipment
  tool?: string;
  toolDurability?: number;
  
  // Performance metrics
  performance: {
    miningEfficiency: number;
    resourceDiscoveryRate: number;
    toolDurability: number;
    blocksPerMinute: number;
    pathEfficiency: number;
  };
  
  // Predictions and risk assessment
  predictedYield?: number;
  riskAssessment?: {
    lava: number;
    water: number;
    mobs: number;
    fall: number;
  };
  
  // Mining pattern information
  miningPattern?: {
    type: 'strip' | 'branch' | 'quarry';
    direction: 'north' | 'south' | 'east' | 'west';
    depth: number;
  };
  
  // Recent mining history
  recentOres?: Array<{
    type: string;
    count: number;
    location: Vec3;
  }>;
}

/**
 * Mining target configuration.
 * Defines what blocks to mine and their priorities.
 * 
 * @example
 * ```typescript
 * const target: MiningTarget = {
 *   blockType: 'iron_ore',
 *   priority: 80,
 *   minimumQuantity: 32,
 *   preferredBiomes: ['mountains', 'hills'],
 *   preferredYLevels: [32, 64]
 * };
 * ```
 */
export interface MiningTarget {
  blockType: string;
  priority: number;
  minimumQuantity: number;
  preferredBiomes: string[];
  preferredYLevels: number[];
}

/**
 * Mining operation result.
 * Contains the outcome of a mining operation.
 * 
 * @example
 * ```typescript
 * const result: MiningResult = {
 *   success: true,
 *   blocksMined: 64,
 *   resources: [
 *     { type: 'iron_ore', count: 32 },
 *     { type: 'coal_ore', count: 16 }
 *   ],
 *   efficiency: {
 *     blocksPerMinute: 45,
 *     toolDurability: 0.8
 *   },
 *   duration: 120
 * };
 * ```
 */
export interface MiningResult {
  success: boolean;
  blocksMined: number;
  resources: Array<{
    type: string;
    count: number;
  }>;
  efficiency: MiningEfficiency;
  duration: number;
}

/**
 * Mining safety configuration.
 * Defines safety parameters for mining operations.
 * 
 * @example
 * ```typescript
 * const safety: MiningSafety = {
 *   maxDepth: 64,
 *   minLightLevel: 8,
 *   avoidLava: true,
 *   avoidWater: true,
 *   mobProtection: true,
 *   fallProtection: true
 * };
 * ```
 */
export interface MiningSafety {
  maxDepth: number;
  minLightLevel: number;
  avoidLava: boolean;
  avoidWater: boolean;
  mobProtection: boolean;
  fallProtection: boolean;
}

/**
 * Mining tool configuration.
 * Defines tool usage and maintenance.
 * 
 * @example
 * ```typescript
 * const tool: MiningTool = {
 *   type: 'diamond_pickaxe',
 *   durability: 1561,
 *   efficiency: 8,
 *   enchantments: [
 *     { type: 'efficiency', level: 3 },
 *     { type: 'unbreaking', level: 2 }
 *   ]
 * };
 * ```
 */
export interface MiningTool {
  type: string;
  durability: number;
  efficiency: number;
  enchantments: Array<{
    type: string;
    level: number;
  }>;
}

/**
 * Mining inventory management.
 * Tracks inventory space and resource collection.
 * 
 * @example
 * ```typescript
 * const inventory: MiningInventory = {
 *   availableSlots: 27,
 *   collectedResources: [
 *     { type: 'iron_ore', count: 32 },
 *     { type: 'coal_ore', count: 16 }
 *   ],
 *   requiredSpace: 5,
 *   sortingStrategy: 'by_priority'
 * };
 * ```
 */
export interface MiningInventory {
  availableSlots: number;
  collectedResources: Array<{
    type: string;
    count: number;
  }>;
  requiredSpace: number;
  sortingStrategy: 'by_priority' | 'by_type' | 'by_quantity';
}

/**
 * Mining path planning.
 * Defines how to navigate to mining locations.
 * 
 * @example
 * ```typescript
 * const path: MiningPath = {
 *   start: { x: 0, y: 64, z: 0 },
 *   end: { x: 100, y: 32, z: -200 },
 *   waypoints: [
 *     { x: 50, y: 64, z: -100 },
 *     { x: 75, y: 48, z: -150 }
 *   ],
 *   difficulty: 'medium',
 *   estimatedTime: 120
 * };
 * ```
 */ 