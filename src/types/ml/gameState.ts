import { Vec3 } from 'vec3';
import { MobPresence, PlayerBehavior, TerrainAnalysis, ResourceDependency } from './state';
import { Inventory } from '../inventory';
import { TaskHistory } from './state';
import { CommandContext } from '../command';
import { MLInventory, MLInventoryConverter } from './shared';
import type { EnhancedGameState as MLEnhancedGameState } from './state';

/**
 * Default bot state properties
 */
export interface BotState {
  position: Vec3;
  velocity: Vec3;
  inventory: MLInventory;
  health: number;
  food: number;
  experience: number;
  selectedItem: string;
  onGround: boolean;
}

/**
 * Default world state properties
 */
export interface SimpleWorldState {
  time: number;
  weather: string;
  dimension: string;
  difficulty: string;
  nearbyEntities: { type: string; position: Vec3 }[];
}

/**
 * Default player state properties
 */
export interface SimplePlayerState {
  position: Vec3;
  inventory: Inventory;
  health: number;
  food: number;
}

/**
 * Default environment properties
 */
export interface SimpleEnvironment {
  time: number;
  weather: string;
  dimension: string;
  biome?: string;
  difficulty: string;
}

/**
 * Default game state properties
 */
export interface GameStateDefaults {
  botState: BotState;
  worldState: SimpleWorldState;
  playerState: SimplePlayerState;
  environment: SimpleEnvironment;
  taskHistory: TaskHistory[];
}

/**
 * Game state factory for creating consistent game state objects
 */
export class GameStateFactory {
  private inventoryConverter: MLInventoryConverter;

  constructor(inventoryConverter: MLInventoryConverter) {
    this.inventoryConverter = inventoryConverter;
  }

  /**
   * Creates a default bot state
   */
  static createDefaultBotState(): BotState {
    return {
      position: new Vec3(0, 0, 0),
      velocity: new Vec3(0, 0, 0),
      inventory: {
        items: [],
        size: 36
      },
      health: 20,
      food: 20,
      experience: 0,
      selectedItem: '',
      onGround: true
    };
  }

  /**
   * Creates a default world state
   */
  static createDefaultWorldState(): SimpleWorldState {
    return {
      time: 0,
      weather: 'clear',
      dimension: 'overworld',
      difficulty: 'normal',
      nearbyEntities: []
    };
  }

  /**
   * Creates a default player state
   */
  static createDefaultPlayerState(): SimplePlayerState {
    return {
      position: new Vec3(0, 0, 0),
      inventory: {
        items: [],
        size: 36,
        type: 'player',
        slots: []
      },
      health: 20,
      food: 20
    };
  }

  /**
   * Creates a default environment
   */
  static createDefaultEnvironment(): SimpleEnvironment {
    return {
      time: 0,
      weather: 'clear',
      dimension: 'overworld',
      biome: 'plains',
      difficulty: 'normal'
    };
  }

  /**
   * Creates a complete game state with default values
   */
  static createDefaultGameState(): GameStateDefaults {
    return {
      botState: this.createDefaultBotState(),
      worldState: this.createDefaultWorldState(),
      playerState: this.createDefaultPlayerState(),
      environment: this.createDefaultEnvironment(),
      taskHistory: []
    };
  }

  /**
   * Creates a command context from game state
   */
  static createCommandContext(): CommandContext {
    const defaults = this.createDefaultGameState();
    
    const enhancedGameState: MLEnhancedGameState = {
      botState: {
        position: defaults.botState.position,
        velocity: defaults.botState.velocity,
        inventory: defaults.botState.inventory,
        health: defaults.botState.health,
        food: defaults.botState.food,
        experience: defaults.botState.experience,
        selectedItem: defaults.botState.selectedItem,
        onGround: defaults.botState.onGround
      },
      worldState: {
        time: defaults.worldState.time,
        weather: defaults.worldState.weather,
        difficulty: defaults.worldState.difficulty,
        dimension: defaults.worldState.dimension
      },
      nearbyEntities: [],
      nearbyBlocks: [],
      resourceState: {
        available: {},
        required: {},
        dependencies: []
      },
      craftingState: {
        recipes: [],
        available: {}
      },
      playerBehavior: {
        lastAction: '',
        actionHistory: [],
        preferences: {},
        skillLevel: 0
      },
      environmentalFactors: [],
      taskHistory: [],
      resourceImpact: [],
      nearbyResources: [],
      terrainAnalysis: {
        elevation: 0,
        biome: 'plains',
        difficulty: 0,
        safety: 0
      },
      mobPresence: {
        type: 'none',
        count: 0,
        distance: 0,
        threatLevel: 0
      }
    };

    return {
      botState: {
        position: defaults.botState.position,
        health: defaults.botState.health,
        food: defaults.botState.food,
        experience: defaults.botState.experience,
        selectedItem: defaults.botState.selectedItem,
        inventory: defaults.botState.inventory.items.map(item => ({
          name: item.type,
          count: item.quantity
        }))
      },
      worldState: {
        time: defaults.worldState.time,
        weather: defaults.worldState.weather,
        difficulty: defaults.worldState.difficulty,
        nearbyEntities: []
      },
      mlState: {
        confidence: 0.5,
        recentPredictions: []
      },
      gameState: enhancedGameState,
      playerState: {
        position: defaults.playerState.position,
        inventory: defaults.playerState.inventory,
        health: defaults.playerState.health,
        food: defaults.playerState.food
      },
      recentCommands: [],
      environment: {
        time: defaults.environment.time,
        weather: defaults.environment.weather,
        difficulty: defaults.environment.difficulty
      },
      taskHistory: defaults.taskHistory
    };
  }
}

export interface EnhancedGameState {
    entities: Array<{
        type: string;
        position: Vec3;
        velocity?: Vec3;
        health?: number;
        metadata?: Record<string, any>;
    }>;
    blocks: Array<{
        type: string;
        position: Vec3;
        metadata?: Record<string, any>;
    }>;
    players: Array<{
        name: string;
        position: Vec3;
        health: number;
        inventory: MLInventory;
    }>;
    resources: Array<{
        type: string;
        position: Vec3;
        quantity: number;
        metadata?: Record<string, any>;
    }>;
    environment: {
        time: number;
        weather: string;
        dimension: string;
        biome?: string;
        difficulty?: string;
    };
} 