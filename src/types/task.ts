import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';

// Base task interface that all tasks must implement
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

// Task type definitions
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

export type TaskPriority = 20 | 50 | 80;
export const TaskPriority = {
  HIGH: 80,
  MEDIUM: 50,
  LOW: 20
} as const;

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Resource requirement types
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

// Task validation types
export interface ValidationCheck {
  type: string;
  condition: string;
  error: string;
}

export interface TaskValidation {
  preChecks?: ValidationCheck[];
  postChecks?: ValidationCheck[];
}

// Task dependency types
export interface TaskDependency {
  type: string;
  parameters: Record<string, any>;
  required: boolean;
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  backoff: number;
  maxDelay: number;
}

// Task parameters based on type

export interface CraftingTaskParameters extends BaseTaskOptions {
  recipe: string;
  materials?: string[];
}

export interface MiningTaskParameters extends BaseTaskOptions {
  block: string;
  quantity?: number;
  maxDistance?: number;
  yLevel?: number;
  usePathfinding?: boolean;
}

export interface FarmingTaskParameters extends BaseTaskOptions {
  cropType: 'wheat' | 'carrots' | 'potatoes' | 'beetroot';
  action: 'harvest' | 'plant' | 'replant';
  quantity?: number;
  radius?: number;
  checkInterval?: number;
  requiresWater?: boolean;
  minWaterBlocks?: number;
  usePathfinding?: boolean;
}

export interface NavigationTaskParameters {
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

export interface InventoryTaskParameters {
  itemType: string;
  quantity: number;
  action: 'check' | 'count' | 'sort';
}

export interface GatheringTaskParameters extends BaseTaskOptions {
  itemType: string;
  quantity: number;
  maxDistance?: number;
  usePathfinding?: boolean;
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
  action: 'toggle' | 'monitor' | 'manage_farm';
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

export interface QueryTaskParameters {
  queryType: 'inventory' | 'position' | 'nearby' | 'status' | 'help';
  description?: string;
  filters?: {
    minCount?: number;
    maxCount?: number;
    radius?: number;
    blockType?: string;
  };
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
}

// Base task options interface
export interface BaseTaskOptions {
  priority?: number;
  timeout?: number;
  retry?: RetryConfig;
  requirements?: TaskRequirements;
  validation?: TaskValidation;
  dependencies?: TaskDependency[];
}

// Union type for all possible task parameters
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

// Main task interface
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

// Task progress interface
export interface TaskProgress {
  taskId: string;
  currentProgress: number;
  totalProgress: number;
  status: TaskStatus;
  estimatedTimeRemaining?: number; // in seconds
  currentLocation?: { x: number; y: number; z: number } | null;
  errorCount?: number;
  retryCount?: number;
  progressHistory?: Array<{ timestamp: number; progress: number }>;
  lastUpdated: number; // timestamp in milliseconds
  created: number; // timestamp in milliseconds
}

// Task result interface
export interface TaskResult {
  success: boolean;
  task: Task;
  error?: string;
  data?: any;
  duration?: number;
}

// Inventory types
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

// Task constructor type
export type TaskConstructor = new (
  bot: MinecraftBot,
  commandHandler: CommandHandler,
  options: TaskParameters
) => BaseTaskInterface;

export interface TaskQueue {
  tasks: Task[];
  add(task: Task): void;
  remove(taskId: string): void;
  update(task: Task): void;
  getNext(): Task | null;
  clear(): void;
  size(): number;
}

export interface TaskHandler {
  canHandle(task: Task): boolean;
  handle(task: Task): Promise<void>;
  validate(task: Task): boolean;
  cleanup(task: Task): void;
} 