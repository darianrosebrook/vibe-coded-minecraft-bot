export interface TrainingMetrics {
  epoch: number;
  loss: number;
  accuracy: number;
  validationLoss: number;
  validationAccuracy: number;
}

export interface ResourceUsage {
  timestamp: number;
  cpu: number;
  memory: number;
  network: number;
}

export interface CommandMetrics {
  command: string;
  successRate: number;
  averageExecutionTime: number;
  totalExecutions: number;
}

export interface ModelConfig {
  learningRate: number;
  batchSize: number;
  layers: number[];
  optimizer: string;
  lossFunction: string;
}

export interface TrainingDataStats {
  totalSamples: number;
  actionDistribution: { action: string; count: number }[];
  averageReward: number;
  successRate: number;
}

export type MLMetricsType = 'training' | 'resources' | 'commands' | 'config' | 'stats';

export interface MLMetrics {
  type: MLMetricsType;
  data: TrainingMetrics | ResourceUsage | CommandMetrics | ModelConfig | TrainingDataStats;
}

export interface MLModelTrainer {
  getCurrentEpoch(): number;
  getTotalEpochs(): number;
  getModelAccuracy(): number;
  getTrainingMetrics(): TrainingMetrics[];
  getLearningRate(): number;
  getBatchSize(): number;
  getNetworkLayers(): number[];
  getOptimizer(): string;
  getLossFunction(): string;
  train(epochs: number, batchSize: number): Promise<void>;
  pauseTraining(): void;
  resumeTraining(): void;
  resetModel(): void;
}

export interface MLDataCollector {
  getCommandMetrics(): CommandMetrics[];
  getTotalSamples(): number;
  getActionDistribution(): { action: string; count: number }[];
  getAverageReward(): number;
  getSuccessRate(): number;
} 