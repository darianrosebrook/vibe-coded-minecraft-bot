import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { EntityInfo, BlockInfo, TaskHistory } from '@/types/ml/state';
import { Recipe } from 'prismarine-recipe';

/**
 * EnhancedGameState interface with a focus on ML training and prediction needs.
 * This extends the base GameState with additional information needed for ML operations.
 */
export interface EnhancedGameState {
  /** Bot instance */
  bot: Bot;
  
  /** Timestamp of state capture */
  timestamp: number;
  
  /** Position in the world */
  position: Vec3;
  
  /** Current health level */
  health: number;
  
  /** Current food level */
  food: number;
  
  /** Biome information */
  biome: { name: string; temperature: number; rainfall: number };
  
  /** Time of day */
  timeOfDay: number;
  
  /** Whether it is raining */
  isRaining?: boolean;
  
  /** Nearby blocks */
  nearbyBlocks: Array<BlockInfo>;
  
  /** Nearby entities */
  nearbyEntities: Array<EntityInfo & { distance: number }>;
  
  /** Movement and orientation data */
  movement: { 
    velocity: Vec3; 
    yaw: number; 
    pitch: number; 
    control: { 
      sprint: boolean; 
      sneak: boolean 
    } 
  };
  
  /** Environmental context */
  environment: { 
    blockAtFeet: string; 
    blockAtHead: string; 
    lightLevel: number; 
    isInWater: boolean; 
    onGround: boolean 
  };
  
  /** Recent tasks executed by the bot */
  recentTasks: Array<{ 
    type: string; 
    parameters: Record<string, any>; 
    status: 'success' | 'failure' | 'in_progress'; 
    timestamp: number 
  }>;
  
  /** Inventory accessors */
  inventory: { 
    items: () => Array<{ name: string; count: number }>; 
    emptySlots: () => number; 
    slots: Array<any> 
  };
  
  /** Known players in the vicinity */
  players: { 
    [key: string]: { 
      username: string; 
      position: Vec3 
    } 
  };
  
  /** Tracked tasks for ML optimizations */
  tasks: Array<TaskHistory>;
}

export interface ResourceDependency {
  resourceType: string;
  quantity: number;
  dependencies: Array<{
    resourceType: string;
    quantity: number;
    dependencies: Array<ResourceDependency>;
    craftingSteps: string[];
  }>;
  craftingSteps: string[];
}

export interface CraftingRecipe extends Recipe {
  output: string;
  inputs: Record<string, number>;
  tools: string[];
  time: number;
}

export interface PlayerBehavior {
  requestType: string;
  frequency: number;
  timeOfDay: number;
  context: string;
  successRate: number;
  timestamp: number;
  success: boolean;
  lastAction?: string;
  actionHistory?: string[];
  preferences?: Record<string, any>;
  skillLevel?: number;
}

export interface EnvironmentalFactor {
  type: string;
  intensity: number;
  impact: string;
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
  type: string;
  difficulty: number;
  elevation: number;
  slope: number;
}

export interface MobPresence {
  type: string;
  count: number;
  threatLevel: number;
  distance: number;
} 