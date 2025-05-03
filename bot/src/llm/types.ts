import { MinecraftBot } from '../bot/bot';
import { Task, TaskParameters, TaskType } from '@/types/task';
import { ParsingError as ParsingErrorType, ErrorRecoveryStrategy } from './error/handler';
import { TaskResolution } from './resolution/system';

export interface TaskContext {
  bot: MinecraftBot;
  conversationHistory: Array<{
    role: 'user' | 'bot';
    content: string;
    timestamp: number;
  }>;
  worldState: {
    inventory: {
      hasTool(tool: string): boolean;
      hasMaterials(materials: string[]): boolean;
      hasSpace(): boolean;
      items: Array<{
        name: string;
        count: number;
        metadata?: number;
      }>;
    };
    position: { x: number; y: number; z: number };
    surroundings: Array<{
      type: string;
      position?: { x: number; y: number; z: number };
      metadata?: any;
    }>;
    time: number;
    pathfinding?: {
      isPathClear: boolean;
      isRouteSafe: boolean;
      knownLandmarks: string[];
    };
  };
  botState?: {
    health: number;
    hunger: number;
    position: { x: number; y: number; z: number };
    biome?: string;
    isDay?: boolean;
    isRaining?: boolean;
  };
  recentTasks: Array<{
    type: TaskType;
    parameters: TaskParameters;
    status: 'success' | 'failure';
    timestamp: number;
  }>;
  pluginContext: Record<string, any>;
  currentTask?: Task;
}

export interface TaskParseResult {
  type: string;
  parameters: TaskParameters;
  confidence: number;
  alternatives: Array<{
    type: string;
    parameters: Record<string, any>;
    confidence: number;
  }>;
  context: TaskContext;
  pluginRequirements: Array<{
    plugin: string;
    capabilities: string[];
    required: boolean;
  }>;
}

export interface SystemMetrics {
  parsing: {
    totalAttempts: number;
    successfulParses: number;
    averageConfidence: number;
    averageTime: number;
  };
  resolution: {
    totalAttempts: number;
    successfulResolutions: number;
    fallbackUsage: number;
    averageTime: number;
  };
  errorHandling: {
    totalErrors: number;
    recoveredErrors: number;
    averageRecoveryTime: number;
    errorTypes: Record<string, number>;
  };
}

export interface DebugInfo {
  parsing: {
    input: string;
    context: TaskContext;
    result?: TaskParseResult;
    error?: ParsingErrorType;
  };
  resolution: {
    strategy: string;
    result?: TaskResolution;
    error?: ParsingErrorType;
  };
  errorHandling: {
    error?: ParsingErrorType;
    strategy?: ErrorRecoveryStrategy;
    result?: TaskResolution;
  };
  metrics: SystemMetrics;
}

export interface ParsingMetrics {
  totalAttempts: number;
  successfulParses: number;
  averageConfidence: number;
  averageTime: number;
  errorCount: number;
  tokenUsage: number;
}

export interface ParsingError {
  type: 'type_mismatch' | 'parameter_invalid' | 'context_missing' | 'ambiguous';
  message: string;
  context: TaskContext;
  recoveryStrategy?: string;
  pluginError?: {
    plugin: string;
    error: string;
    recoveryStrategy?: string;
  };
}

export interface ParsingResult {
  task: TaskParseResult;
  confidence: number;
  alternatives: TaskParseResult[];
  metrics: ParsingMetrics;
  debugInfo: {
    intent: string;
    semanticScore: number;
    patternMatch: boolean;
    validationSteps: string[];
  };
}

export interface TaskParserConfig {
  minConfidence: number;
  maxAlternatives: number;
  enableML: boolean;
  enableCaching: boolean;
  cacheSize: number;
  timeout: number;
} 