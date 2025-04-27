import { Bot } from 'mineflayer';
import { Task } from './task';

export interface TaskModule {
  name: string;
  description: string;
  schema: object;
  execute: (bot: Bot, params: any) => Promise<void>;
  validate?: (params: any) => boolean;
  hooks?: {
    before?: (bot: Bot, params: any) => Promise<void>;
    after?: (bot: Bot, params: any, result: any) => Promise<void>;
    error?: (bot: Bot, params: any, error: Error) => Promise<void>;
  };
}

export interface PluginRegistry {
  register: (module: TaskModule) => void;
  unregister: (name: string) => void;
  get: (name: string) => TaskModule | undefined;
  list: () => TaskModule[];
  execute: (task: Task) => Promise<void>;
}

export interface PluginEvent {
  type: string;
  task?: Task;
  module?: TaskModule;
  error?: Error;
  timestamp: number;
  metadata?: Record<string, any>;
}

export type PluginEventListener = (event: PluginEvent) => void; 