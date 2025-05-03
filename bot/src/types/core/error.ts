/**
 * Core error handling types used throughout the project.
 * These types define the structure for error reporting, handling, and recovery.
 */

/**
 * Categories of errors that can occur in the bot
 */
export type ErrorCategory =
  | 'TASK_EXECUTION'
  | 'RESOURCE_MANAGEMENT'
  | 'NAVIGATION'
  | 'INVENTORY'
  | 'COMBAT'
  | 'CRAFTING'
  | 'ML_PREDICTION'
  | 'VALIDATION'
  | 'UNKNOWN';

/**
 * Severity levels for errors
 */
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Context information for an error
 */
export interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
  stackTrace?: string;
  relatedTaskId?: string;
  botState?: {
    position: { x: number; y: number; z: number };
    health: number;
    food: number;
    inventory: Array<{ name: string; count: number }>;
  };
}

/**
 * Configuration for retrying failed operations
 */
export interface RetryStrategy {
  maxAttempts: number;
  backoff: number;
  maxDelay: number;
  conditions: Array<{
    type: string;
    value: any;
    operator: 'equals' | 'greaterThan' | 'lessThan' | 'contains';
  }>;
}

/**
 * Fallback strategy when retries are exhausted
 */
export interface FallbackStrategy {
  type: string;
  conditions: Array<{
    type: string;
    value: any;
    operator: 'equals' | 'greaterThan' | 'lessThan' | 'contains';
  }>;
  actions: string[];
  priority: number;
} 