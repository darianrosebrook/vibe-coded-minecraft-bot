/**
 * Machine Learning Model Types
 * 
 * This module defines the types used for ML models in the Minecraft Bot.
 * These types handle model configuration, training, and inference.
 * 
 * @module MLModel
 */

/**
 * Base configuration for all ML models.
 * Defines common properties and settings used across different model types.
 * 
 * @example
 * ```typescript
 * const modelConfig: BaseModelConfig = {
 *   modelId: 'mining-pattern-v1',
 *   version: '1.0.0',
 *   type: 'neural_network',
 *   hyperparameters: {
 *     learningRate: 0.001,
 *     batchSize: 32,
 *     epochs: 100
 *   },
 *   inputFeatures: ['block_type', 'depth', 'biome'],
 *   outputFeatures: ['next_block', 'efficiency']
 * };
 * ```
 */
export interface BaseModelConfig {
  modelId: string;
  version: string;
  type: 'neural_network' | 'decision_tree' | 'random_forest' | 'svm';
  hyperparameters: {
    learningRate?: number;
    batchSize?: number;
    epochs?: number;
    maxDepth?: number;
    minSamplesSplit?: number;
  };
  inputFeatures: string[];
  outputFeatures: string[];
}

/**
 * Configuration for neural network models.
 * Extends base configuration with neural network specific settings.
 * 
 * @example
 * ```typescript
 * const nnConfig: NeuralNetworkConfig = {
 *   ...baseConfig,
 *   architecture: {
 *     layers: [
 *       { type: 'dense', units: 64, activation: 'relu' },
 *       { type: 'dropout', rate: 0.2 },
 *       { type: 'dense', units: 32, activation: 'relu' },
 *       { type: 'dense', units: 16, activation: 'softmax' }
 *     ],
 *     optimizer: 'adam',
 *     loss: 'categorical_crossentropy'
 *   }
 * };
 * ```
 */
export interface NeuralNetworkConfig extends BaseModelConfig {
  architecture: {
    layers: Array<{
      type: 'dense' | 'convolutional' | 'recurrent' | 'dropout';
      units?: number;
      activation?: string;
      rate?: number;
    }>;
    optimizer: string;
    loss: string;
  };
}

/**
 * Training data structure for ML models.
 * Contains input features and expected outputs.
 * 
 * @example
 * ```typescript
 * const trainingData: TrainingData = {
 *   inputs: [
 *     { block_type: 'stone', depth: 32, biome: 'plains' },
 *     { block_type: 'dirt', depth: 16, biome: 'forest' }
 *   ],
 *   outputs: [
 *     { next_block: 'coal_ore', efficiency: 0.85 },
 *     { next_block: 'iron_ore', efficiency: 0.92 }
 *   ]
 * };
 * ```
 */
export interface TrainingData {
  inputs: Array<Record<string, any>>;
  outputs: Array<Record<string, any>>;
}

/**
 * Model performance metrics.
 * Tracks various aspects of model performance during training and inference.
 * 
 * @example
 * ```typescript
 * const metrics: ModelMetrics = {
 *   accuracy: 0.95,
 *   loss: 0.12,
 *   precision: 0.94,
 *   recall: 0.96,
 *   f1Score: 0.95,
 *   inferenceTime: 0.05,
 *   trainingTime: 3600
 * };
 * ```
 */
export interface ModelMetrics {
  accuracy: number;
  loss: number;
  precision: number;
  recall: number;
  f1Score: number;
  inferenceTime: number;
  trainingTime: number;
}

/**
 * Model training progress.
 * Tracks the current state of model training.
 * 
 * @example
 * ```typescript
 * const progress: TrainingProgress = {
 *   epoch: 45,
 *   totalEpochs: 100,
 *   batch: 32,
 *   totalBatches: 1000,
 *   metrics: {
 *     accuracy: 0.92,
 *     loss: 0.15
 *   }
 * };
 * ```
 */
export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  batch: number;
  totalBatches: number;
  metrics: {
    accuracy: number;
    loss: number;
  };
}

/**
 * Model inference result.
 * Contains the model's predictions and confidence scores.
 * 
 * @example
 * ```typescript
 * const result: InferenceResult = {
 *   predictions: [
 *     { next_block: 'iron_ore', confidence: 0.95 },
 *     { next_block: 'coal_ore', confidence: 0.05 }
 *   ],
 *   metadata: {
 *     inferenceTime: 0.05,
 *     modelVersion: '1.0.0'
 *   }
 * };
 * ```
 */
export interface InferenceResult {
  predictions: Array<{
    [key: string]: any;
    confidence: number;
  }>;
  metadata: {
    inferenceTime: number;
    modelVersion: string;
  };
}

/**
 * Model validation result.
 * Contains the results of model validation tests.
 * 
 * @example
 * ```typescript
 * const validation: ModelValidation = {
 *   passed: true,
 *   metrics: {
 *     accuracy: 0.94,
 *     loss: 0.13
 *   },
 *   tests: [
 *     { name: 'accuracy_test', passed: true, value: 0.94 },
 *     { name: 'loss_test', passed: true, value: 0.13 }
 *   ]
 * };
 * ```
 */
export interface ModelValidation {
  passed: boolean;
  metrics: {
    accuracy: number;
    loss: number;
  };
  tests: Array<{
    name: string;
    passed: boolean;
    value: number;
  }>;
}

/**
 * Machine Learning model types and configurations.
 * These types define the structure and behavior of ML models used by the bot.
 */

/**
 * Base model configuration interface
 */
export interface ModelConfig {
  name: string;
  version: string;
  type: 'classification' | 'regression' | 'reinforcement' | 'custom';
  framework: 'tensorflow' | 'pytorch' | 'custom';
  inputShape: number[];
  outputShape: number[];
  layers: ModelLayer[];
  optimizer: OptimizerConfig;
  loss: LossConfig;
  metrics: string[];
}

/**
 * Model layer configuration
 */
export interface ModelLayer {
  type: string;
  units?: number;
  activation?: string;
  kernelSize?: number[];
  stride?: number[];
  padding?: 'valid' | 'same';
  dropout?: number;
  batchNormalization?: boolean;
  parameters?: Record<string, any>;
}

/**
 * Optimizer configuration
 */
export interface OptimizerConfig {
  type: 'adam' | 'sgd' | 'rmsprop' | 'custom';
  learningRate: number;
  beta1?: number;
  beta2?: number;
  epsilon?: number;
  momentum?: number;
  decay?: number;
  parameters?: Record<string, any>;
}

/**
 * Loss function configuration
 */
export interface LossConfig {
  type: string;
  parameters?: Record<string, any>;
}

/**
 * Model training configuration
 */
export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  shuffle: boolean;
  callbacks: CallbackConfig[];
  earlyStopping?: {
    patience: number;
    minDelta: number;
    monitor: string;
  };
  checkpoint?: {
    path: string;
    saveBestOnly: boolean;
    monitor: string;
  };
}

/**
 * Training callback configuration
 */
export interface CallbackConfig {
  type: string;
  parameters?: Record<string, any>;
}

/**
 * Model deployment configuration
 */
export interface DeploymentConfig {
  mode: 'local' | 'cloud' | 'edge';
  platform?: 'aws' | 'gcp' | 'azure' | 'custom';
  scaling: {
    minInstances: number;
    maxInstances: number;
    targetUtilization: number;
  };
  resources: {
    cpu: number;
    memory: number;
    gpu?: boolean;
  };
  monitoring: {
    enabled: boolean;
    metrics: string[];
    alerts: AlertConfig[];
  };
}

/**
 * Alert configuration for model monitoring
 */
export interface AlertConfig {
  metric: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==';
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: string;
}

/**
 * Model version information
 */
export interface ModelVersion {
  version: string;
  timestamp: number;
  changes: string[];
  performance: {
    accuracy: number;
    loss: number;
    inferenceTime: number;
  };
  artifacts: {
    model: string;
    weights: string;
    config: string;
    metadata: string;
  };
}

/**
 * Model metadata
 */
export interface ModelMetadata {
  name: string;
  description: string;
  author: string;
  created: number;
  lastUpdated: number;
  tags: string[];
  dependencies: {
    framework: string;
    version: string;
    libraries: Record<string, string>;
  };
  requirements: {
    python: string;
    system: string[];
    gpu?: boolean;
  };
}

/**
 * Model state interface
 */
export interface ModelState {
  config: ModelConfig;
  version: ModelVersion;
  metadata: ModelMetadata;
  status: 'idle' | 'training' | 'inference' | 'error';
  lastActivity: number;
  metrics: {
    training?: Record<string, number>;
    validation?: Record<string, number>;
    inference?: Record<string, number>;
  };
}

export interface Model {
  id: string;
  name: string;
  version: string;
  architecture: ModelArchitecture;
  metrics: ModelMetrics;
  lastUpdated: number;
}

export interface ModelArchitecture {
  layers: Layer[];
  inputShape: number[];
  outputShape: number[];
}

export interface Layer {
  type: string;
  units: number;
  activation: string;
  config?: Record<string, any>;
}

export interface ABTestConfig {
  controlModel: string;
  testModel: string;
  metrics: string[];
  duration: number;
  sampleSize: number;
} 