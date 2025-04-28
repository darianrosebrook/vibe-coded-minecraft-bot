import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

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
  nearbyBlocks: Array<{ type: string; position: Vec3 }>;
  /** Nearby entities */
  nearbyEntities: Array<{ type: string; position: Vec3; distance: number }>;
  /** Movement and orientation data */
  movement: { velocity: Vec3; yaw: number; pitch: number; control: { sprint: boolean; sneak: boolean } };
  /** Environmental context */
  environment: { blockAtFeet: string; blockAtHead: string; lightLevel: number; isInWater: boolean; onGround: boolean };
  /** Recent tasks executed by the bot */
  recentTasks: Array<{ type: string; parameters: Record<string, any>; status: 'success' | 'failure' | 'in_progress'; timestamp: number }>;
  /** Inventory accessors */
  inventory: { items: () => Array<{ name: string; count: number }>; emptySlots: () => number; slots: Array<any> };
  /** Known players in the vicinity */
  players: { [key: string]: { username: string; position: Vec3 } };
  /** Tracked tasks for ML optimizations */
  tasks: Array<{ id: string; type: string; status: 'running' | 'completed' | 'failed'; startTime: number; endTime?: number }>;
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

export interface CraftingRecipe {
  result: string;
  ingredients: Array<{
    name: string;
    count: number;
  }>;
  craftingTime: number;
  difficulty: number;
}

export interface PlayerBehavior {
  requestType: string;
  frequency: number;
  timeOfDay: number;
  context: string;
  successRate: number;
  timestamp: number;
  success: boolean;
}

export interface EnvironmentalFactor {
  type: string;
  impact: number;
  weight: number;
}

export interface TaskHistory {
  taskId: string;
  taskType: string;
  startTime: number;
  endTime: number;
  success: boolean;
  resourcesUsed: Map<string, number>;
  executionTime: number;
}

export interface ResourceImpact {
  type: string;
  impact: number;
  availability: number;
  distance: number;
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