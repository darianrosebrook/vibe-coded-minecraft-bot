import { Vec3 } from 'vec3';
import { Inventory } from '@/types/inventory'; 
import { TaskHistory } from '@/types/ml/state';
import { EnhancedGameState } from '@/types/ml/state';

/**
 * Machine Learning Command Types
 * 
 * This module defines types for ML command processing and execution.
 * These types handle command parsing, validation, and execution flow.
 * 
 * @module MLCommand
 */

/**
 * Base interface for all ML commands.
 * Provides common functionality for command processing.
 * 
 * @example
 * ```typescript
 * const command: BaseMLCommand = {
 *   commandId: 'mine-iron-1',
 *   timestamp: Date.now(),
 *   type: 'mining',
 *   parameters: {
 *     targetBlock: 'iron_ore',
 *     quantity: 32
 *   },
 *   priority: 50,
 *   status: CommandStatus.PENDING
 * };
 * ```
 */
export interface BaseMLCommand {
  commandId: string;
  timestamp: number;
  type: string;
  parameters: Record<string, any>;
  priority: number;
  status: CommandStatus;
}

/**
 * Command execution status.
 * Tracks the current state of command processing.
 * 
 * @example
 * ```typescript
 * const status: CommandStatus = CommandStatus.IN_PROGRESS;
 * ```
 */
export enum CommandStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Command validation result.
 * Contains validation checks and their results.
 * 
 * @example
 * ```typescript
 * const validation: CommandValidation = {
 *   isValid: true,
 *   checks: [
 *     { name: 'block_exists', passed: true },
 *     { name: 'inventory_space', passed: true }
 *   ],
 *   errors: []
 * };
 * ```
 */
export interface CommandValidation {
  isValid: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
  }>;
  errors: string[];
}

/**
 * Command execution result.
 * Contains the outcome of command execution.
 * 
 * @example
 * ```typescript
 * const result: CommandResult = {
 *   success: true,
 *   command: miningCommand,
 *   data: {
 *     blocksMined: 32,
 *     itemsCollected: ['iron_ore'],
 *     duration: 120
 *   },
 *   metrics: {
 *     efficiency: 0.95,
 *     accuracy: 0.98
 *   }
 * };
 * ```
 */
export interface CommandResult {
  success: boolean;
  command: BaseMLCommand;
  data?: Record<string, any>;
  metrics?: {
    efficiency: number;
    accuracy: number;
  };
}

/**
 * Command queue configuration.
 * Defines how commands are prioritized and processed.
 * 
 * @example
 * ```typescript
 * const config: CommandQueueConfig = {
 *   maxConcurrent: 5,
 *   timeout: 300,
 *   retryAttempts: 3,
 *   priorityLevels: {
 *     high: 20,
 *     medium: 50,
 *     low: 80
 *   }
 * };
 * ```
 */
export interface CommandQueueConfig {
  maxConcurrent: number;
  timeout: number;
  retryAttempts: number;
  priorityLevels: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Command handler interface.
 * Defines the contract for command processing.
 * 
 * @example
 * ```typescript
 * class MiningCommandHandler implements CommandHandler {
 *   async validate(command: BaseMLCommand): Promise<CommandValidation> {
 *     // Implementation
 *   }
 *   
 *   async execute(command: BaseMLCommand): Promise<CommandResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export interface CommandHandler {
  validate(command: BaseMLCommand): Promise<CommandValidation>;
  execute(command: BaseMLCommand): Promise<CommandResult>;
}

/**
 * Command context interface.
 * Contains contextual information for command execution.
 * 
 * @example
 * ```typescript
 * const context: CommandContext = {
 *   botState: {
 *     position: { x: 100, y: 64, z: -200 },
 *     health: 20,
 *     inventory: [...]
 *   },
 *   worldState: {
 *     time: 6000,
 *     weather: 'clear',
 *     nearbyEntities: [...]
 *   },
 *   mlState: {
 *     confidence: 0.95,
 *     recentPredictions: [...]
 *   }
 * };
 * ```
 */
export interface CommandContext {
  botState: {
    position: Vec3;
    health: number;
    food: number;
    experience: number;
    selectedItem?: string;
    inventory: Array<{
      name: string;
      count: number;
    }>;
  };
  worldState: {
    time: number;
    weather: string;
    difficulty: string;
    nearbyEntities: Array<{
      type: string;
      position: Vec3;
    }>;
  };
  mlState: {
    confidence: number;
    recentPredictions: Array<{
      type: string;
      confidence: number;
    }>;
  };
  gameState: EnhancedGameState;
  playerState: {
    position: Vec3;
    inventory: Inventory;
    health: number;
    food: number;
  };
  recentCommands: string[];
  environment: {
    time: number;
    weather: string;
    difficulty: string;
  };
  taskHistory: TaskHistory[];
}

/**
 * Command execution metrics.
 * Tracks performance and success rates.
 * 
 * @example
 * ```typescript
 * const metrics: CommandMetrics = {
 *   totalExecuted: 100,
 *   successRate: 0.95,
 *   averageDuration: 2.5,
 *   errorRate: 0.05,
 *   byType: {
 *     mining: { success: 50, failed: 2 },
 *     crafting: { success: 30, failed: 1 }
 *   }
 * };
 * ```
 */
export interface CommandMetrics {
  totalExecuted: number;
  successRate: number;
  averageDuration: number;
  errorRate: number;
  byType: Record<string, {
    success: number;
    failed: number;
  }>;
}

/**
 * Command recovery strategy.
 * Defines how to handle failed commands.
 * 
 * @example
 * ```typescript
 * const recovery: CommandRecovery = {
 *   maxAttempts: 3,
 *   backoff: 5,
 *   strategies: [
 *     { type: 'retry', priority: 1 },
 *     { type: 'fallback', priority: 2 }
 *   ]
 * };
 * ```
 */
export interface CommandRecovery {
  maxAttempts: number;
  backoff: number;
  strategies: Array<{
    type: 'retry' | 'fallback' | 'alternative';
    priority: number;
  }>;
}

/**
 * Machine Learning command processing types.
 * These types define how the bot processes and executes ML-enhanced commands.
 */

/**
 * Base command interface
 */
export interface BaseCommand {
  id: string;
  type: string;
  timestamp: number;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

/**
 * Command prediction interface
 */
export interface CommandPrediction {
  command: string;
  confidence: number;
  alternatives: Array<{
    command: string;
    confidence: number;
  }>;
  contextRelevance: number;
  parameters?: Record<string, any>;
}

/**
 * Mining command interface
 */
export interface MiningCommand extends BaseCommand {
  targetBlock: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  quantity?: number;
  tool?: string;
  useML?: boolean;
  riskAssessment?: {
    lava: number;
    water: number;
    mobs: number;
    fall: number;
  };
}

/**
 * Redstone command interface
 */
export interface RedstoneCommand extends BaseCommand {
  circuitType: string;
  action: 'build' | 'modify' | 'analyze';
  components: Array<{
    type: string;
    position: { x: number; y: number; z: number };
    state?: boolean;
  }>;
  connections?: Array<{
    from: number;
    to: number;
    type: string;
  }>;
  timing?: {
    delay: number;
    pulseLength: number;
  };
}

/**
 * Chat command interface
 */
export interface ChatCommand extends BaseCommand {
  message: string;
  context: {
    lastMessage?: string;
    playerName?: string;
    botState?: {
      position: { x: number; y: number; z: number };
      health: number;
      food: number;
      inventory: Array<{ name: string; count: number }>;
    };
  };
  useML?: boolean;
  responseOptions?: Array<{
    text: string;
    confidence: number;
    contextRelevance: number;
  }>;
}

export interface IntentClassification {
  intent: string;
  confidence: number;
  parameters: Record<string, any>;
  context: CommandContext;
}

export interface SimilarCommand {
  command: string;
  similarity: number;
  context: CommandContext;
}

export interface ErrorPrediction {
  type: string;
  probability: number;
  context: CommandContext;
  suggestedFix?: string;
}

export interface ResponseQuality {
  clarity: number;
  relevance: number;
  completeness: number;
  confidence: number;
}

/**
 * Command pattern interface for pattern recognition.
 */
export interface CommandPattern {
  pattern: string;
  intent: string;
  parameters: Record<string, string>;
  examples: string[];
  context: CommandContext;
  metadata?: {
    confidence: number;
    updateTimestamp: number;
    createdTimestamp?: number;
    usageCount?: number;
  };
}

export interface MLCommandParser {
  parse: (input: string, context: CommandContext) => Promise<IntentClassification>;
  validate: (intent: IntentClassification) => Promise<boolean>;
  suggest: (input: string, context: CommandContext) => Promise<SimilarCommand[]>;
}

export interface MLResponseGenerator {
  generate: (intent: IntentClassification, context: CommandContext) => Promise<string>;
  evaluate: (response: string, context: CommandContext) => Promise<ResponseQuality>;
}

export interface MLErrorHandler {
  predict: (input: string, context: CommandContext) => Promise<ErrorPrediction[]>;
  suggest: (error: ErrorPrediction) => Promise<string[]>;
}

export interface PatternRecognitionSystem {
  recognize: (input: string, context: CommandContext) => Promise<CommandPattern[]>;
  learn: (pattern: CommandPattern) => Promise<void>;
} 