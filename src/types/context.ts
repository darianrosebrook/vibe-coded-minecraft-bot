export interface PluginState {
  plugin: string;
  state: Record<string, any>;
  version: number;
  timestamp: number;
  dependencies: string[];
}

export interface StateChange {
  plugin: string;
  changes: Record<string, any>;
  previousState: Record<string, any>;
  timestamp: number;
  cause: string;
}

export interface StateValidation {
  plugin: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  timestamp: number;
} 