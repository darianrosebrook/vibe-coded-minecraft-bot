import { TaskHistory } from '@/types/ml/state';

/**
 * Task Context
 * 
 * Contains contextual information about the current task and environment
 * that ML components can use to make informed decisions.
 */
export interface TaskContext {
  // Bot state information
  botState: {
    position: { x: number; y: number; z: number };
    inventory: Array<{ name: string; count: number }>;
    health: number;
    food: number;
    experience?: number;
    selectedItem?: string;
  };
  
  // World state information
  worldState: {
    time: number;
    weather: string;
    dimension?: string;
    difficulty?: string;
    nearbyEntities: Array<{
      type: string;
      position: { x: number; y: number; z: number };
      health?: number;
      distance?: number;
    }>;
    nearbyBlocks?: Array<{
      type: string;
      position: { x: number; y: number; z: number };
    }>;
  };
  
  // Current task information
  currentTask?: {
    id: string;
    type: string;
    goal: string;
    progress: number;
    started: number;
    estimatedCompletion?: number;
  };
  
  // Previous task history
  taskHistory: TaskHistory[];
  
  // Resources information
  resources?: {
    available: Record<string, number>;
    required: Record<string, number>;
    nearby: Array<{
      type: string;
      position: { x: number; y: number; z: number };
      quantity: number;
      distance: number;
    }>;
  };
  
  // User preferences and settings
  userPreferences?: {
    playstyle: string;
    prioritizedResources: string[];
    safetyLevel: number;
    automationLevel: number;
  };
  
  // Additional metadata
  metadata?: Record<string, any>;
} 