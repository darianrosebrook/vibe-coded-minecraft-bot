import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

export interface EnhancedGameState {
  bot: Bot;
  timestamp: number;
  position: Vec3;
  inventory: {
    items: () => Array<{
      name: string;
      count: number;
    }>;
    emptySlots: () => number;
    slots: Array<any>;
  };
  players: {
    [key: string]: {
      username: string;
      position: Vec3;
    };
  };
  tasks: Array<{
    id: string;
    type: string;
    status: 'running' | 'completed' | 'failed';
    startTime: number;
    endTime?: number;
  }>;
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