import { Vec3 } from 'vec3';
import { MLInventory, MLItem } from './shared';
import { Inventory } from '../inventory';

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
 */
export interface BaseMLState {
  stateId: string;
  timestamp: number;
  isValid: boolean;
  metadata: Record<string, any>;
}

/**
 * State validation interface for ensuring state integrity
 */
export interface MLStateValidation {
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
 * State transition tracking
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
 * State history tracking
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
 * State recovery tracking
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

/**
 * Enhanced game state that aggregates various aspects of the game world
 */
export interface EnhancedGameState {
  botState: {
    position: Vec3;
    velocity: Vec3;
    inventory: MLInventory;
    health: number;
    food: number;
    experience: number;
    selectedItem: string;
    onGround: boolean;
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

/**
 * Core type definitions shared by all state implementations
 */

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

/**
 * Common ML model interfaces
 */

export interface ResourceDependency {
  resource: string;
  required: number;
  available: number;
  sources: string[];
}

export interface CraftingRecipe {
  output: string;
  inputs: Record<string, number>;
  tools?: string[];
  time?: number;
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

/**
 * Context weight for determining importance of different state aspects
 */
export interface ContextWeight {
  category: string;
  baseWeight: number;
  decayRate: number;
  maxWeight: number;
  relevance?: number;
} 