import { MinecraftBot } from '@/bot/bot';
import { CommandHandler } from '@/commands';
import { Vec3 } from 'vec3';
import { IDataCollector } from '@/types/ml/interfaces';

// Import ML state types

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

/**
 * Current state of a task in the execution lifecycle.
 * 
 * @example
 * ```typescript
 * const taskStatus: TaskStatus = TaskStatus.IN_PROGRESS;
 * ```
 */

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
  action: 'harvest' | 'plant' | 'replant';
  area: {
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
  };
  checkInterval?: number;
  cropType: 'wheat' | 'carrots' | 'potatoes' | 'beetroot';
  maxRetries?: number;
  minWaterBlocks?: number;
  quantity?: number;
  radius?: number;
  requiresWater?: boolean;
  retryDelay?: number;
  timeout?: number;
  useML?: boolean;
  usePathfinding?: boolean;
  waterSources?: Vec3[];
}

export interface NavigationTaskParameters extends BaseTaskOptions {
  avoidWater?: boolean;
  location: {
    x: number;
    y: number;
    z: number;
  };
  maxDistance?: number;
  mode?: 'walk' | 'sprint' | 'jump';
  usePathfinding?: boolean;
  radius?: number;
}

export interface InventoryTaskParameters extends BaseTaskOptions {
  itemType?: string;
  operation: 'check' | 'count' | 'sort';
  quantity?: number;
}

export interface GatheringTaskParameters extends BaseTaskOptions {
  avoidWater?: boolean;
  itemType: string;
  quantity?: number;
  radius?: number;
  spacing?: number;
  usePathfinding?: boolean;
}

export interface ProcessingTaskParameters extends BaseTaskOptions {
  itemType: string;
  processType: 'smelt' | 'craft' | 'brew';
  quantity: number;
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
  avoidWater?: boolean;
  biomeName?: string;
  radius: number;
  resourceType?: string;
  spacing?: number;
  usePathfinding?: boolean;
}

export interface StorageTaskParameters {
  action: 'store' | 'retrieve' | 'organize';
  itemType: string;
  quantity: number;
}

export interface CombatTaskParameters {
  followDistance?: number;
  targetName?: string;
  targetType: 'player' | 'mob';
  weaponSlot?: number;
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
  chatType: "whisper" | "normal" | "system" | "action";
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
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  useML?: boolean;
}

/**
 * Base task options interface
 */
export interface BaseTaskOptions {
  avoidWater?: boolean;
  dependencies?: TaskDependency[];
  maxRetries?: number;
  priority?: number;
  requirements?: TaskRequirements;
  retryDelay?: number;
  timeout?: number;
  useML?: boolean;
  usePathfinding?: boolean;
  validation?: TaskValidation;
  dataCollector?: IDataCollector;
}

/**
 * Union type for all possible task parameters
 */
export type TaskParameters =
  | ChatTaskParameters
  | CombatTaskParameters
  | ConstructionTaskParameters
  | ExplorationTaskParameters
  | FarmingTaskParameters
  | GatheringTaskParameters
  | InventoryTaskParameters
  | MiningTaskParameters
  | NavigationTaskParameters
  | ProcessingTaskParameters
  | QueryTaskParameters
  | RedstoneTaskParameters
  | StorageTaskParameters

/**
 * Main task interface that represents a unit of work for the Minecraft bot
 * @interface Task
 * @property {string} id - Unique identifier for the task
 * @property {TaskType} type - The type of task to be performed
 * @property {TaskParameters} parameters - Task-specific parameters and configuration
 * @property {TaskPriority} priority - Priority level of the task (lower numbers = higher priority)
 * @property {TaskStatus} status - Current status of the task
 * @property {Date} [createdAt] - Timestamp when the task was created
 * @property {Date} [updatedAt] - Timestamp when the task was last updated
 * @property {string[]} [dependencies] - List of task IDs that must complete before this task can start
 * @property {number} [timeout] - Maximum time in milliseconds before the task is considered failed
 * @property {number} [retryCount] - Number of times the task has been retried
 * @property {number} [maxRetries] - Maximum number of retry attempts allowed
 * @property {string} [error] - Error message if the task failed
 * @property {Record<string, any>} [metadata] - Additional metadata about the task
 */
export interface Task {
  id: string;
  type: TaskType;
  parameters: TaskParameters;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt?: Date;
  updatedAt?: Date;
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
  taskId?: string;
  currentProgress: number;
  totalProgress: number;
  status: TaskStatus;
  estimatedTimeRemaining?: number;
  currentLocation?: { x: number; y: number; z: number } | null;
  errorCount?: number;
  retryCount?: number;
  progressHistory?: Array<{ timestamp: number; progress: number }>;
  lastUpdated?: number;
  created?: number;
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

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  parameters: TaskParameters;
  result?: TaskResult;
  progress?: TaskProgress;
  createdAt?: Date;
  updatedAt?: Date;
  dependencies?: string[];
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface TaskResult {
  success: boolean;
  error?: string;
  data?: any;
  duration?: number;
  task?: Task;
}

export interface TaskProgress {
  current: number;
  total: number;
  status: TaskStatus;
  message?: string;
  taskId?: string;
  estimatedTimeRemaining?: number;
  currentLocation?: { x: number; y: number; z: number } | null;
  errorCount?: number;
  retryCount?: number;
  progressHistory?: Array<{ timestamp: number; progress: number }>;
  lastUpdated?: number;
  created?: number;
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 20,
  MEDIUM = 50,
  HIGH = 80
}