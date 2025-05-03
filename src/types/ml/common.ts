/**
 * Common ML Types
 * 
 * This module defines shared types used across different ML components.
 * These types are used to maintain consistency and avoid duplication.
 */

import { Vec3 } from 'vec3';

/**
 * Base metrics interface for all ML models
 */
export interface BaseMetrics {
  timestamp: number;
  modelName: string;
  version: string;
  environment: {
    cpuUsage: number;
    memoryUsage: number;
    gpuUsage?: number;
  };
}

/**
 * Model metrics that track performance across training and inference
 */
export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingLoss: number;
  validationLoss: number;
  inferenceTime: number;
  memoryUsage: number;
}

/**
 * Model version information
 */
export interface ModelVersion {
  version: string;
  timestamp: number;
  metrics: ModelMetrics;
  trainingData: {
    size: number;
    distribution: Record<string, number>;
  };
  hyperparameters: Record<string, any>;
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: string;
  lossFunction: string;
  validationSplit: number;
  earlyStopping: {
    patience: number;
    minDelta: number;
  };
  dataAugmentation?: Record<string, any>;
}

/**
 * A/B Testing configuration
 */
export interface ABTestConfig {
  controlModel: string;
  testModel: string;
  metrics: string[];
  duration: number;
  sampleSize: number;
  confidenceLevel: number;
  successCriteria: Record<string, number>;
}

/**
 * Interface for ML state prediction
 */
export interface MLStatePrediction {
  resourceNeeds: {
    type: string;
    quantity: number;
    confidence: number;
  }[];
  playerRequests: {
    type: string;
    confidence: number;
    expectedTime: number;
  }[];
  taskDurations: {
    taskType: string;
    expectedDuration: number;
    confidence: number;
  }[];
}

/**
 * Interface for context weighting
 */
export interface ContextWeight {
  relevance: number;
  decay: number;
  lastUpdated: number;
} 