/**
 * Represents the state of a plugin at a specific point in time
 */
export interface PluginState {
  /** Name of the plugin */
  plugin: string;
  /** Current state data of the plugin */
  state: Record<string, any>;
  /** Version of the state format */
  version: number;
  /** Timestamp when the state was recorded */
  timestamp: number;
  /** List of plugins this plugin depends on */
  dependencies: string[];
}

/**
 * Represents a change in plugin state
 */
export interface StateChange {
  /** Name of the plugin that changed */
  plugin: string;
  /** Object containing the changes made */
  changes: Record<string, any>;
  /** Previous state before the changes */
  previousState: Record<string, any>;
  /** Timestamp when the change occurred */
  timestamp: number;
  /** Description of what caused the change */
  cause: string;
}

/**
 * Represents the validation result of a plugin state
 */
export interface StateValidation {
  /** Name of the plugin being validated */
  plugin: string;
  /** Whether the state is valid */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
  /** Timestamp of the validation */
  timestamp: number;
} 