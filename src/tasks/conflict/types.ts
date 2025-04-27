export enum ConflictType {
  RESOURCE = 'RESOURCE',
  LOCATION = 'LOCATION',
  TOOL = 'TOOL',
  TIME = 'TIME'
}

export interface ResourceConflict {
  type: ConflictType.RESOURCE;
  resourceType: string;
  requiredQuantity: number;
  availableQuantity: number;
  conflictingTasks: string[];
}

export interface LocationConflict {
  type: ConflictType.LOCATION;
  position: { x: number; y: number; z: number };
  radius: number;
  conflictingTasks: string[];
}

export interface ToolConflict {
  type: ConflictType.TOOL;
  toolType: string;
  conflictingTasks: string[];
}

export interface TimeConflict {
  type: ConflictType.TIME;
  startTime: number;
  endTime: number;
  conflictingTasks: string[];
}

export type Conflict = ResourceConflict | LocationConflict | ToolConflict | TimeConflict;

export interface ConflictResolution {
  conflict: Conflict;
  resolution: 'AUTO' | 'MANUAL';
  resolved: boolean;
  action?: string;
  message: string;
} 