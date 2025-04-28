import { z } from 'zod';

/**
 * Bot configuration types that define how the bot behaves and operates.
 * These types are used to configure the bot's behavior, capabilities, and limitations.
 */

/**
 * Core bot configuration settings
 */
export const BotConfigSchema = z.object({
  username: z.string(),
  host: z.string(),
  port: z.number(),
  version: z.string(),
  auth: z.enum(['microsoft', 'mojang', 'offline']),
  viewDistance: z.number().min(1).max(32),
  chatLengthLimit: z.number().min(100),
  respawn: z.boolean(),
  defaultTimeout: z.number().min(1000),
  plugins: z.array(z.string()),
  mlEnabled: z.boolean(),
  performanceMonitoring: z.boolean(),
  errorHandling: z.object({
    maxRetries: z.number().min(0),
    retryDelay: z.number().min(0),
    fallbackStrategies: z.array(z.string()),
  }),
});

export type BotConfig = z.infer<typeof BotConfigSchema>;

export interface BotPlugin {
  name: string;
  version: string;
  dependencies?: string[];
  initialize(bot: any): Promise<void>;
  cleanup?(): Promise<void>;
  onEvent?(event: string, data: any): Promise<void>;
}

/**
 * Navigation configuration settings
 */
export interface NavigationConfig {
  pathfinding: {
    algorithm: 'A_STAR' | 'DIJKSTRA' | 'BFS';
    maxDistance: number;
    avoidMobs: boolean;
    avoidWater: boolean;
    avoidLava: boolean;
  };
  movement: {
    speed: number;
    jumpHeight: number;
    sprintEnabled: boolean;
    sneakEnabled: boolean;
  };
  exploration: {
    radius: number;
    priority: 'RESOURCES' | 'STRUCTURES' | 'BALANCED';
  };
}

/**
 * Combat configuration settings
 */
export interface CombatConfig {
  enabled: boolean;
  mode: 'DEFENSIVE' | 'AGGRESSIVE' | 'PASSIVE';
  weapons: {
    melee: boolean;
    ranged: boolean;
    magic: boolean;
  };
  targeting: {
    priority: 'DANGER' | 'DISTANCE' | 'HEALTH';
    maxDistance: number;
    avoidFriendlyFire: boolean;
  };
  healing: {
    autoHeal: boolean;
    threshold: number;
    items: string[];
  };
}

/**
 * Resource gathering configuration
 */
export interface ResourceConfig {
  mining: {
    enabled: boolean;
    tools: string[];
    priority: 'DIAMOND' | 'IRON' | 'COAL' | 'CUSTOM';
    customPriority: string[];
  };
  farming: {
    enabled: boolean;
    crops: string[];
    autoReplant: boolean;
  };
  woodcutting: {
    enabled: boolean;
    tools: string[];
    types: string[];
  };
}

/**
 * Inventory management configuration
 */
export interface InventoryConfig {
  autoSort: boolean;
  maxWeight: number;
  essentialItems: string[];
  disposalRules: Array<{
    item: string;
    condition: 'BELOW' | 'ABOVE';
    value: number;
  }>;
}

/**
 * Task management configuration
 */
export interface TaskConfig {
  maxConcurrent: number;
  timeout: number;
  retryAttempts: number;
  priority: {
    mining: number;
    farming: number;
    combat: number;
    crafting: number;
  };
}

/**
 * Machine learning configuration
 */
export interface MLConfig {
  enabled: boolean;
  model: string;
  training: {
    enabled: boolean;
    interval: number;
    batchSize: number;
  };
  prediction: {
    confidenceThreshold: number;
    maxAttempts: number;
  };
} 