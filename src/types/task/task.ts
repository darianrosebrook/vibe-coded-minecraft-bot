/**
 * Type Organization
 * 
 * This project uses a modular type system organized as follows:
 * 
 *src/types/
├── core/
│   ├── position.ts
│   └── error.ts
├── bot/
│   └── config.ts
├── inventory/
│   └── inventory.ts
├── ml/
│   ├── performance.ts
│   ├── model.ts
│   ├── state.ts
│   ├── command.ts
│   ├── mining.ts
│   ├── redstone.ts
│   └── chat.ts
├── index.ts
└── task.ts
 * 
 * When adding new types, please place them in the appropriate directory
 * based on their domain and usage.
 */

import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Vec3 } from 'vec3';

// Import ML state types
import { MiningMLState } from './ml/mining';
import { RedstoneMLState } from './ml/redstone';
import { ChatMLState } from './ml/chat';

/**
 * Task System Documentation
 * 
 * This module defines the core task system types used throughout the Minecraft Bot.
 * Tasks represent discrete units of work that the bot can perform, such as mining,
 * farming, crafting, etc. Each task type has its own parameters and requirements.
 * 
 * Example Usage:
 * ```typescript
 * // Creating a mining task
 * const miningTask: Task = {
 *   id: 'mine-iron-1',
 *   type: TaskType.MINING,
 *   parameters: {
 *     targetBlock: 'iron_ore',
 *     quantity: 32,
 *     maxDistance: 50,
 *     usePathfinding: true
 *   },
 *   priority: 50,
 *   status: TaskStatus.PENDING
 * };
 * ```
 */

/**
 * Base task interface that all tasks must implement
 * 
 * @example
 * ```typescript
 * class MiningTask implements BaseTaskInterface {
 *   async execute(task: Task, taskId: string): Promise<TaskResult> {
 *     // Implementation
 *   }
 *   // ... other required methods
 * }
 * ```
 */
export interface BaseTaskInterface {
  execute(task: Task | null, taskId: string): Promise<TaskResult>;
  validateTask(): Promise<void>;
  initializeProgress(): Promise<void>;
  performTask(): Promise<void>;
  updateProgress(progress: number): Promise<void>;
  shouldRetry(): boolean;
  retry(): Promise<void>;
  stop(): void;
}

/**
 * Types of tasks the bot can perform
 */
export enum TaskType {
  MINING = 'mining',
  FARMING = 'farming',
  CRAFTING = 'crafting',
  NAVIGATION = 'navigation',
  QUERY = 'query',
  GATHERING = 'gathering',
  INVENTORY = 'inventory',
  COMBAT = 'combat',
  INTERACTION = 'interaction',
  HEALING = 'healing',
  CHAT = 'chat',
  UNKNOWN = 'unknown'
}

/**
 * Priority levels for task execution.
 * Lower numbers indicate higher priority.
 * 
 * @example
 * ```typescript
 * const highPriorityTask: Task = {
 *   // ... other properties
 *   priority: 20  // High priority
 * };
 * ```
 */
export type TaskPriority = 20 | 50 | 80;
export const TaskPriority = {
  HIGH: 80,
  MEDIUM: 50,
  LOW: 20
} as const;

/**
 * Current state of a task in the execution lifecycle.
 * 
 * @example
 * ```typescript
 * const taskStatus: TaskStatus = TaskStatus.IN_PROGRESS;
 * ```
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Requirements for task execution, including items, tools, blocks, and entities.
 * 
 * @example
 * ```typescript
 * const requirements: TaskRequirements = {
 *   items: [
 *     { type: 'diamond_pickaxe', quantity: 1, required: true }
 *   ],
 *   blocks: [
 *     { type: 'iron_ore', quantity: 32, required: true }
 *   ]
 * };
 * ```
 */
export interface ResourceRequirement {
  type: string;
  quantity: number;
  required: boolean;
}

export interface ToolRequirement {
  type: string;
  material: string;
  required: boolean;
}

export interface BlockRequirement {
  type: string;
  quantity: number;
  required: boolean;
}

export interface EntityRequirement {
  type: string;
  quantity: number;
  required: boolean;
}

export interface TaskRequirements {
  items?: ResourceRequirement[];
  tools?: ToolRequirement[];
  blocks?: BlockRequirement[];
  entities?: EntityRequirement[];
}

/**
 * Task validation types
 */
export interface ValidationCheck {
  type: string;
  condition: string;
  error: string;
}

export interface TaskValidation {
  preChecks?: ValidationCheck[];
  postChecks?: ValidationCheck[];
}

/**
 * Task dependency types
 */
export interface TaskDependency {
  type: string;
  parameters: Record<string, any>;
  required: boolean;
}

/**
 * Retry configuration for failed tasks
 */
export interface RetryConfig {
  maxAttempts: number;
  backoff: number;
  maxDelay: number;
}

/**
 * Task-specific parameter interfaces
 */
export interface CraftingTaskParameters extends BaseTaskOptions {
  recipe: string;
  materials?: string[];
}

/**
 * Parameters specific to mining tasks.
 * 
 * @example
 * ```typescript
 * const miningParams: MiningTaskParameters = {
 *   targetBlock: 'iron_ore',
 *   quantity: 32,
 *   maxDistance: 50,
 *   usePathfinding: true,
 *   tool: 'diamond_pickaxe',
 *   avoidWater: true
 * };
 * ```
 */
export interface MiningTaskParameters extends BaseTaskOptions {
  targetBlock: string;
  quantity?: number;
  maxDistance?: number;
  yLevel?: number;
  usePathfinding?: boolean;
  tool?: string;
  radius?: number;
  depth?: number;
  useML?: boolean;
  avoidWater?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface FarmingTaskParameters extends BaseTaskOptions {
  cropType: 'wheat' | 'carrots' | 'potatoes' | 'beetroot';
  action: 'harvest' | 'plant' | 'replant';
  area: {
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
  };
  quantity?: number;
  radius?: number;
  checkInterval?: number;
  requiresWater?: boolean;
  minWaterBlocks?: number;
  usePathfinding?: boolean;
  waterSources?: Vec3[];
  useML?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface NavigationTaskParameters extends BaseTaskOptions {
  location: {
    x: number;
    y: number;
    z: number;
  };
  mode?: 'walk' | 'sprint' | 'jump';
  avoidWater?: boolean;
  maxDistance?: number;
  usePathfinding?: boolean;
}

export interface InventoryTaskParameters extends BaseTaskOptions {
  operation: 'check' | 'count' | 'sort';
  itemType?: string;
  quantity?: number;
}

export interface GatheringTaskParameters extends BaseTaskOptions {
  itemType: string;
  quantity?: number;
  radius?: number;
  usePathfinding?: boolean;
  avoidWater?: boolean;
  spacing?: number;
}

export interface ProcessingTaskParameters extends BaseTaskOptions {
  itemType: string;
  quantity: number;
  processType: 'smelt' | 'craft' | 'brew';
}

export interface ConstructionTaskParameters extends BaseTaskOptions {
  blockType: string;
  dimensions: {
    x: number;
    y: number;
    z: number;
  };
  pattern?: string;
}

export interface ExplorationTaskParameters extends BaseTaskOptions {
  resourceType?: string;
  biomeName?: string;
  radius: number;
  spacing?: number;
  avoidWater?: boolean;
  usePathfinding?: boolean;
}

export interface StorageTaskParameters {
  itemType: string;
  quantity: number;
  action: 'store' | 'retrieve' | 'organize';
}

export interface CombatTaskParameters {
  targetType: 'player' | 'mob';
  targetName?: string;
  weaponSlot?: number;
  followDistance?: number;
}

export interface RedstoneTaskParameters extends BaseTaskOptions {
  circuitType: string;
  radius: number;
  area?: {
    start: Vec3;
    end: Vec3;
  };
  devices?: Array<{
    type: string;
    position: Vec3;
    connections?: Vec3[];
  }>;
  action?: 'toggle' | 'monitor' | 'manage_farm';
  target?: {
    type: 'lever' | 'button' | 'pressure_plate' | 'redstone_torch' | 'redstone_block' | 'repeater' | 'comparator';
    position: { x: number; y: number; z: number };
    state: boolean;
  };
  circuit?: {
    devices: Array<{
      type: 'lever' | 'button' | 'pressure_plate' | 'redstone_torch' | 'redstone_block' | 'repeater' | 'comparator';
      position: { x: number; y: number; z: number };
      state: boolean;
    }>;
    connections: Array<{ from: number; to: number }>;
  };
  farmConfig?: {
    cropTypes: string[];
    radius: number;
    checkInterval: number;
    requiresWater: boolean;
    minWaterBlocks: number;
  };
}

export interface QueryTaskParameters extends BaseTaskOptions {
  queryType: 'inventory' | 'block' | 'entity' | 'biome' | 'time';
  description?: string;
  filters?: {
    minCount?: number;
    maxCount?: number;
    radius?: number;
    blockType?: string;
  };
  useML?: boolean;
}

export interface ChatTaskParameters extends BaseTaskOptions {
  message: string;
  context?: {
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
  useML?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Base task options interface
 */
export interface BaseTaskOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  useML?: boolean;
  avoidWater?: boolean;
  usePathfinding?: boolean;
  priority?: number;
  requirements?: TaskRequirements;
  validation?: TaskValidation;
  dependencies?: TaskDependency[];
}

/**
 * Union type for all possible task parameters
 */
export type TaskParameters = 
  | MiningTaskParameters
  | FarmingTaskParameters
  | NavigationTaskParameters
  | InventoryTaskParameters
  | GatheringTaskParameters
  | ProcessingTaskParameters
  | ConstructionTaskParameters
  | ExplorationTaskParameters
  | StorageTaskParameters
  | CombatTaskParameters
  | RedstoneTaskParameters
  | QueryTaskParameters
  | ChatTaskParameters;

/**
 * Main task interface
 */
export interface Task {
  id: string;
  type: TaskType;
  parameters: TaskParameters;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  dependencies?: string[];
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Task progress tracking interface
 */
export interface TaskProgress {
  taskId: string;
  currentProgress: number;
  totalProgress: number;
  status: TaskStatus;
  estimatedTimeRemaining?: number;
  currentLocation?: { x: number; y: number; z: number } | null;
  errorCount?: number;
  retryCount?: number;
  progressHistory?: Array<{ timestamp: number; progress: number }>;
  lastUpdated: number;
  created: number;
}

/**
 * Task result interface
 */
export interface TaskResult {
  success: boolean;
  task: Task;
  error?: string;
  data?: any;
  duration?: number;
}

/**
 * Inventory management types
 */
export interface InventorySlot {
  slot: number;
  item: {
    name: string;
    count: number;
    metadata?: number;
  };
}

export interface InventoryCategory {
  name: string;
  slots: number[];
  priority: number;
  filter?: {
    items: string[];
    maxQuantity?: number;
  };
}

/**
 * Task constructor type
 */
export type TaskConstructor = new (
  bot: MinecraftBot,
  commandHandler: CommandHandler,
  options: TaskParameters
) => BaseTaskInterface;

/**
 * Task queue management interface
 */
export interface TaskQueue {
  tasks: Task[];
  add(task: Task): void;
  remove(taskId: string): void;
  update(task: Task): void;
  getNext(): Task | null;
  clear(): void;
  size(): number;
}

/**
 * Task handler interface
 */
export interface TaskHandler {
  canHandle(task: Task): boolean;
  handle(task: Task): Promise<void>;
  validate(task: Task): boolean;
  cleanup(task: Task): void;
} 