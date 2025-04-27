// Common error types
export type ErrorCategory = 'PARSING' | 'EXECUTION' | 'VALIDATION' | 'CONTEXT' | 'PLUGIN';
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ErrorContext {
  taskId?: string;
  taskType?: string;
  parameters?: Record<string, any>;
  timestamp: number;
  source: string;
}

export interface RetryStrategy {
  maxAttempts: number;
  backoffMs: number;
  conditions: string[];
}

export interface FallbackStrategy {
  type: string;
  parameters: Record<string, any>;
  conditions: string[];
}

// Generic type utilities
export type Vec3 = { x: number; y: number; z: number };

export interface Position {
  x: number;
  y: number;
  z: number;
  yaw?: number;
  pitch?: number;
}

export interface BlockState {
  type: string;
  position: Vec3;
  metadata?: Record<string, any>;
}

// Shared type guards
export function isVec3(value: any): value is Vec3 {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.z === 'number'
  );
}

export function isPosition(value: any): value is Position {
  if (!value || typeof value !== 'object') return false;
  const pos = value as Position;
  return (
    isVec3(value) &&
    (pos.yaw === undefined || typeof pos.yaw === 'number') &&
    (pos.pitch === undefined || typeof pos.pitch === 'number')
  );
}

export function isBlockState(value: any): value is BlockState {
  if (!value || typeof value !== 'object') return false;
  return (
    typeof value.type === 'string' &&
    isVec3(value.position) &&
    (value.metadata === undefined || typeof value.metadata === 'object')
  );
} 