import { Vec3 } from 'vec3';
import { Bot } from 'mineflayer';

export interface InteractionLog {
  timestamp: number;
  type: string;
  data: any;
  result: any;
  success: boolean;
}

export interface StateChangeLog {
  timestamp: number;
  previousState: any;
  newState: any;
  trigger: string;
}

export interface ResourceChangeLog {
  timestamp: number;
  resourceType: string;
  previousAmount: number;
  newAmount: number;
  cause: string;
}

export interface EnhancedGameState {
  position: Vec3;
  inventory: Bot['inventory'];
  health: number;
  food: number;
  experience: number;
  gameTime: number;
  weather: string;
  biome: string;
  nearbyEntities: any[];
  nearbyBlocks: any[];
  lastInteraction?: InteractionLog;
  lastStateChange?: StateChangeLog;
  lastResourceChange?: ResourceChangeLog;
}

export interface ModelConfig {
  training: {
    enabled: boolean;
    batchSize: number;
    epochs: number;
    learningRate: number;
    validationSplit: number;
  };
  optimization: {
    enabled: boolean;
    updateInterval: number;
    maxHistorySize: number;
  };
  enabled: boolean;
  dataCollection: {
    enabled: boolean;
    interval: number;
    maxSize: number;
  };
  feedback: {
    enabled: boolean;
    interval: number;
    threshold: number;
  };
  dataPath: string;
  dataRetentionPeriod: number;
  maxDataSize: number;
  modelPath?: string;
}

export interface ModelMetrics {
  accuracy: number;
  loss: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
}

export interface ABTestResult {
  modelA: {
    metrics: ModelMetrics;
    predictions: any[];
  };
  modelB: {
    metrics: ModelMetrics;
    predictions: any[];
  };
  winner: 'A' | 'B' | 'tie';
  confidence: number;
} 