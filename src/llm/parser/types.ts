import { Bot } from 'mineflayer';
import { Player } from 'mineflayer';
import { Task, TaskParameters } from '../../types/task';

export interface TaskContext {
  player: Player;
  bot: Bot;
  surroundings: {
    blocks: any[];
    entities: any[];
    inventory: any[];
  };
  recentTasks: Task[];
  pluginStates: Record<string, any>;
}

export interface TaskParseResult {
  task: Task;
  confidence: number;
  context: TaskContext;
  errors: string[];
}

export interface ParsingError {
  message: string;
  code: string;
  context: any;
}

export interface TaskValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TaskResolutionResult {
  task: Task;
  context: TaskContext;
  validation: TaskValidationResult;
}

export interface PromptTemplate {
  template: string;
  variables: string[];
  context: {
    required: string[];
    optional: string[];
  };
}

export interface PluginContext {
  name: string;
  version: string;
  state: any;
  capabilities: string[];
  dependencies: string[];
} 