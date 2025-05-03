/**
 * ML Types Index
 * 
 * This file re-exports all ML-related types to provide a centralized access point.
 */

// Re-export all ML types with proper namespacing
export * from './common';
export * from './state';
export * from './command';
export * from './mining';
export * from './redstone';
export * from './chat';
export * from './performance';
export * from './model';
export * from './feedback';
export * from './data';
export * from './interfaces';

// Export training types
export { ModelMetrics, ABTestResult } from './training';

// Base ML state types
export * from './state';

// Feature-specific state types 
export { MiningMLState, MineralDeposit, MiningTool, MiningPath } from '../../ml/state/miningState';
export { ExplorationMLState, ResourceDistribution, BiomeTransition, ExplorationPath } from '../../ml/state/explorationState';
export { RedstoneMLState, RedstoneDeviceState, RedstoneCircuitState, FarmState } from '../../ml/state/redstoneState';

// Prediction and model types
export { Model, BaseModel, TaskDurationModel, ResourceNeedModel, PlayerRequestModel } from '../../ml/state/models';
export { ProcessedData } from '../../ml/state/data_preprocessor';

// Storage related types
export { ModelStorage, StoredModel } from '../../ml/state/model_storage';
export { TrainingDataStorage } from '../../ml/state/training_data_storage';

// Core game state from context
export { GameState } from '../../llm/context/manager';

// We need to directly use these interfaces from state.ts since validation.ts doesn't exist yet
export { MLStateValidation, ContextWeight } from './state';
// Define MLStatePrediction interface inline since it's not in state.ts
export interface MLStatePrediction {
  predictionType: string;
  timestamp: number;
  inputs: Record<string, any>;
  prediction: any;
  confidence: number;
  groundTruth?: any;
  error?: number;
  metadata?: Record<string, any>;
}

export * from './validation';
export * from './navigation';
export * from './player';

 
 