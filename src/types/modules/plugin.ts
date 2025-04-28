import { Bot } from 'mineflayer';
import { Task } from '../task/task';

/**
 * Represents a task module that can be executed by the bot
 */
export interface TaskModule {
  /** Unique name of the module */
  name: string;
  /** Description of what the module does */
  description: string;
  /** JSON schema for validating module parameters */
  schema: object;
  /** Main execution function for the module */
  execute: (bot: Bot, params: any) => Promise<void>;
  /** Optional function to validate parameters before execution */
  validate?: (params: any) => boolean;
  /** Optional lifecycle hooks for the module */
  hooks?: {
    /** Function called before module execution */
    before?: (bot: Bot, params: any) => Promise<void>;
    /** Function called after successful module execution */
    after?: (bot: Bot, params: any, result: any) => Promise<void>;
    /** Function called if module execution fails */
    error?: (bot: Bot, params: any, error: Error) => Promise<void>;
  };
}

/**
 * Registry for managing task modules
 */
export interface PluginRegistry {
  /** Register a new task module */
  register: (module: TaskModule) => void;
  /** Remove a task module by name */
  unregister: (name: string) => void;
  /** Get a task module by name */
  get: (name: string) => TaskModule | undefined;
  /** List all registered task modules */
  list: () => TaskModule[];
  /** Execute a task using the appropriate module */
  execute: (task: Task) => Promise<void>;
}

/**
 * Represents an event in the plugin system
 */
export interface PluginEvent {
  /** Type of event */
  type: string;
  /** Associated task (if any) */
  task?: Task;
  /** Associated module (if any) */
  module?: TaskModule;
  /** Error that occurred (if any) */
  error?: Error;
  /** Timestamp of the event */
  timestamp: number;
  /** Additional event metadata */
  metadata?: Record<string, any>;
}

/**
 * Callback function for plugin events
 */
export type PluginEventListener = (event: PluginEvent) => void; 