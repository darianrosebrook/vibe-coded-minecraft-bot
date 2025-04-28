import { Vec3 } from 'vec3';
import { Position } from '../common';

/**
 * Machine Learning State Types
 * 
 * This module defines the core state types used by the ML system to track and manage
 * the bot's learning and decision-making processes. These states are used to:
 * - Track the bot's current understanding of the game world
 * - Manage learning progress and performance
 * - Guide decision-making processes
 * - Store historical data for training
 * 
 * @module MLState
 */

/**
 * Base interface for all ML states.
 * Provides common functionality and properties for state tracking.
 * 
 * @example
 * ```typescript
 * class CustomMLState implements BaseMLState {
 *   stateId: string;
 *   timestamp: number;
 *   isValid: boolean;
 *   metadata: Record<string, any>;
 *   
 *   constructor() {
 *     this.stateId = generateUniqueId();
 *     this.timestamp = Date.now();
 *     this.isValid = true;
 *     this.metadata = {};
 *   }
 * }
 * ```
 */
export interface BaseMLState {
  stateId: string;
  timestamp: number;
  isValid: boolean;
  metadata: Record<string, any>;
}

/**
 * State for mining-related ML operations.
 * Tracks the bot's understanding of mining patterns and efficiency.
 * 
 * @example
 * ```typescript
 * const miningState: MiningMLState = {
 *   stateId: 'mining-123',
 *   timestamp: Date.now(),
 *   isValid: true,
 *   metadata: {},
 *   miningPattern: {
 *     type: 'strip',
 *     direction: 'north',
 *     depth: 3
 *   },
 *   efficiency: {
 *     blocksPerMinute: 45,
 *     toolDurability: 0.8,
 *     pathEfficiency: 0.95
 *   },
 *   recentOres: [
 *     { type: 'iron_ore', count: 12, location: { x: 100, y: 32, z: -200 } }
 *   ]
 * };
 * ```
 */
export interface MiningMLState extends BaseMLState {
  miningPattern: {
    type: 'strip' | 'branch' | 'quarry';
    direction: 'north' | 'south' | 'east' | 'west';
    depth: number;
  };
  efficiency: {
    blocksPerMinute: number;
    toolDurability: number;
    pathEfficiency: number;
  };
  recentOres: Array<{
    type: string;
    count: number;
    location: Position;
  }>;
}

/**
 * State for redstone-related ML operations.
 * Tracks circuit complexity and performance metrics.
 * 
 * @example
 * ```typescript
 * const redstoneState: RedstoneMLState = {
 *   stateId: 'redstone-456',
 *   timestamp: Date.now(),
 *   isValid: true,
 *   metadata: {},
 *   circuitComplexity: {
 *     components: 25,
 *     layers: 3,
 *     connections: 40
 *   },
 *   performance: {
 *     ticksPerOperation: 2,
 *     reliability: 0.99,
 *     powerEfficiency: 0.95
 *   },
 *   recentCircuits: [
 *     { type: 'piston_door', successRate: 0.98, complexity: 'medium' }
 *   ]
 * };
 * ```
 */
export interface RedstoneMLState extends BaseMLState {
  circuitComplexity: {
    components: number;
    layers: number;
    connections: number;
  };
  performance: {
    ticksPerOperation: number;
    reliability: number;
    powerEfficiency: number;
  };
  recentCircuits: Array<{
    type: string;
    successRate: number;
    complexity: 'simple' | 'medium' | 'complex';
  }>;
}

/**
 * State for chat-related ML operations.
 * Tracks conversation patterns and response effectiveness.
 * 
 * @example
 * ```typescript
 * const chatState: ChatMLState = {
 *   stateId: 'chat-789',
 *   timestamp: Date.now(),
 *   isValid: true,
 *   metadata: {},
 *   conversationContext: {
 *     lastMessage: 'Hello bot!',
 *     playerName: 'Steve',
 *     mood: 'friendly'
 *   },
 *   responseMetrics: {
 *     relevance: 0.95,
 *     politeness: 0.9,
 *     helpfulness: 0.85
 *   },
 *   recentInteractions: [
 *     { query: 'Where is iron?', response: 'I found iron at x:100 y:32 z:-200', success: true }
 *   ]
 * };
 * ```
 */
export interface ChatMLState extends BaseMLState {
  conversationContext: {
    lastMessage: string;
    playerName: string;
    mood: 'friendly' | 'neutral' | 'hostile';
  };
  responseMetrics: {
    relevance: number;
    politeness: number;
    helpfulness: number;
  };
  recentInteractions: Array<{
    query: string;
    response: string;
    success: boolean;
  }>;
}

/**
 * Validates the state of an ML operation.
 * Ensures all required properties are present and valid.
 * 
 * @example
 * ```typescript
 * const validation: StateValidation = {
 *   checks: [
 *     { property: 'miningPattern.type', required: true },
 *     { property: 'efficiency.blocksPerMinute', min: 0, max: 100 }
 *   ],
 *   dependencies: [
 *     { property: 'recentOres', dependsOn: 'miningPattern' }
 *   ]
 * };
 * ```
 */
export interface StateValidation {
  checks: Array<{
    property: string;
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
  }>;
  dependencies: Array<{
    property: string;
    dependsOn: string;
  }>;
}

/**
 * Type guard for checking if a state is a MiningMLState
 * 
 * @example
 * ```typescript
 * if (isMiningState(state)) {
 *   console.log(`Mining efficiency: ${state.efficiency.blocksPerMinute}`);
 * }
 * ```
 */
export function isMiningState(state: BaseMLState): state is MiningMLState {
  return 'miningPattern' in state;
}

/**
 * Type guard for checking if a state is a RedstoneMLState
 * 
 * @example
 * ```typescript
 * if (isRedstoneState(state)) {
 *   console.log(`Circuit complexity: ${state.circuitComplexity.components}`);
 * }
 * ```
 */
export function isRedstoneState(state: BaseMLState): state is RedstoneMLState {
  return 'circuitComplexity' in state;
}

/**
 * Type guard for checking if a state is a ChatMLState
 * 
 * @example
 * ```typescript
 * if (isChatState(state)) {
 *   console.log(`Conversation mood: ${state.conversationContext.mood}`);
 * }
 * ```
 */
export function isChatState(state: BaseMLState): state is ChatMLState {
  return 'conversationContext' in state;
}

/**
 * Machine Learning state management types.
 * These types define how the bot tracks and manages the state of its ML models and predictions.
 */

/**
 * Base ML state interface
 */
export interface BaseMLState {
  timestamp: number;
  modelId: string;
  version: string;
  status: 'idle' | 'processing' | 'error';
  confidence: number;
  metadata: Record<string, any>;
}

/**
 * Mining-specific ML state
 */
export interface MiningMLState extends BaseMLState {
  targetBlock: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  surroundingBlocks: Array<{
    type: string;
    position: {
      x: number;
      y: number;
      z: number;
    };
  }>;
  biome: string;
  lightLevel: number;
  tool?: string;
  efficiency: {
    blocksPerMinute: number;
    toolDurability: number;
    pathEfficiency: number;
  };
  predictedYield: number;
  riskAssessment: {
    lava: number;
    water: number;
    mobs: number;
    fall: number;
  };
}

/**
 * Redstone-specific ML state
 */
export interface RedstoneMLState extends BaseMLState {
  circuitType: string;
  components: Array<{
    type: string;
    position: {
      x: number;
      y: number;
      z: number;
    };
    state: boolean;
    power: number;
  }>;
  connections: Array<{
    from: number;
    to: number;
    type: string;
  }>;
  inputSignals: number[];
  outputSignals: number[];
  timing: {
    delay: number;
    pulseLength: number;
    frequency: number;
  };
}

/**
 * Chat-specific ML state
 */
export interface ChatMLState extends BaseMLState {
  context: {
    lastMessage?: string;
    playerName?: string;
    botState?: {
      position: { x: number; y: number; z: number };
      health: number;
      food: number;
      inventory: Array<{ name: string; count: number }>;
      biome?: string;
      isDay?: boolean;
      isRaining?: boolean;
      nearbyEntities?: Array<{
        type: string;
        name: string;
        distance: number;
        position: { x: number; y: number; z: number };
      }>;
    };
  };
  intent: string;
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  sentiment: number;
  responseOptions: Array<{
    text: string;
    confidence: number;
    contextRelevance: number;
  }>;
}

/**
 * State transition interface
 */
export interface StateTransition {
  from: string;
  to: string;
  timestamp: number;
  trigger: string;
  confidence: number;
  metadata?: Record<string, any>;
}

/**
 * State history interface
 */
export interface StateHistory {
  modelId: string;
  transitions: StateTransition[];
  currentState: string;
  lastUpdated: number;
  statistics: {
    totalTransitions: number;
    averageConfidence: number;
    errorRate: number;
    mostCommonState: string;
    stateDurations: Record<string, number>;
  };
}

/**
 * State recovery interface
 */
export interface StateRecovery {
  failedState: string;
  timestamp: number;
  error: string;
  attemptedRecovery: Array<{
    method: string;
    success: boolean;
    duration: number;
    newState?: string;
  }>;
  finalState: string;
  recoveryTime: number;
}

export interface EnhancedGameState {
  botState: {
    position: Vec3;
    inventory: Inventory;
    health: number;
    food: number;
    experience: number;
    selectedItem: string;
  };
  worldState: {
    time: number;
    weather: string;
    difficulty: string;
    dimension: string;
  };
  nearbyEntities: EntityInfo[];
  nearbyBlocks: BlockInfo[];
  resourceState: {
    available: Record<string, number>;
    required: Record<string, number>;
    dependencies: ResourceDependency[];
  };
  craftingState: {
    recipes: CraftingRecipe[];
    available: Record<string, number>;
  };
  playerBehavior: PlayerBehavior;
  environmentalFactors: EnvironmentalFactor[];
  taskHistory: TaskHistory[];
  resourceImpact: ResourceImpact[];
  nearbyResources: NearbyResource[];
  terrainAnalysis: TerrainAnalysis;
  mobPresence: MobPresence;
}

export interface ResourceDependency {
  resource: string;
  required: number;
  available: number;
  sources: string[];
}

export interface CraftingRecipe {
  output: string;
  inputs: Record<string, number>;
  tools: string[];
  time: number;
}

export interface PlayerBehavior {
  lastAction: string;
  actionHistory: string[];
  preferences: Record<string, any>;
  skillLevel: number;
}

export interface EnvironmentalFactor {
  type: string;
  intensity: number;
  impact: string;
}

export interface TaskHistory {
  taskId: string;
  type: string;
  status: string;
  startTime: number;
  endTime?: number;
  resourcesUsed: Record<string, number>;
  success: boolean;
}

export interface ResourceImpact {
  resource: string;
  change: number;
  source: string;
  timestamp: number;
}

export interface NearbyResource {
  type: string;
  position: Vec3;
  quantity: number;
  distance: number;
}

export interface TerrainAnalysis {
  elevation: number;
  biome: string;
  difficulty: number;
  safety: number;
}

export interface MobPresence {
  type: string;
  count: number;
  distance: number;
  threatLevel: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface EntityInfo {
  type: string;
  position: Vec3;
  health?: number;
  metadata?: Record<string, any>;
}

export interface BlockInfo {
  type: string;
  position: Vec3;
  metadata?: Record<string, any>;
}

export interface Inventory {
  items: Item[];
  size: number;
}

export interface Item {
  type: string;
  quantity: number;
  metadata?: Record<string, any>;
} 