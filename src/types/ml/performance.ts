import { BaseMetrics, ModelMetrics, ModelVersion, TrainingConfig, ABTestConfig } from './common';

/**
 * Machine Learning Performance Types
 * 
 * This module defines types for tracking and analyzing ML system performance.
 * These types are used to monitor model efficiency, resource usage, and system health.
 * 
 * @module MLPerformance
 */

/**
 * Machine Learning performance metrics and monitoring types.
 * These types are used to track, analyze, and optimize the bot's ML models and predictions.
 */

/**
 * Training performance metrics
 */
export interface TrainingMetrics extends BaseMetrics {
  epoch: number;
  batchSize: number;
  learningRate: number;
  loss: number;
  accuracy: number;
  validationLoss?: number;
  validationAccuracy?: number;
  trainingTime: number;
  samplesProcessed: number;
  gradientNorm?: number;
}

/**
 * Inference performance metrics
 */
export interface InferenceMetrics extends BaseMetrics {
  predictionTime: number;
  confidence: number;
  inputSize: number;
  outputSize: number;
  cacheHit?: boolean;
  batchSize: number;
  latency: number;
  throughput: number;
}

/**
 * Model health metrics
 */
export interface ModelHealthMetrics extends BaseMetrics {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  lastTrainingTime: number;
  predictionSuccessRate: number;
  averageConfidence: number;
  errorRate: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: number;
}

/**
 * System resource usage metrics.
 * Tracks CPU, memory, and GPU utilization.
 * 
 * @example
 * ```typescript
 * const resources: ResourceMetrics = {
 *   cpu: {
 *     usage: 0.65,
 *     temperature: 45,
 *     cores: 8
 *   },
 *   memory: {
 *     used: 4096,
 *     total: 8192,
 *     swap: 2048
 *   },
 *   gpu: {
 *     usage: 0.75,
 *     temperature: 60,
 *     memory: {
 *       used: 2048,
 *       total: 4096
 *     }
 *   }
 * };
 * ```
 */
export interface ResourceMetrics extends BaseMetrics {
  cpu: {
    usage: number;
    temperature: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    swap: number;
  };
  gpu?: {
    usage: number;
    temperature: number;
    memory: {
      used: number;
      total: number;
    };
  };
  disk: {
    read: number;
    write: number;
    iops: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
    latency: number;
  };
}

/**
 * Performance monitoring configuration.
 * Defines what metrics to track and how often to collect them.
 * 
 * @example
 * ```typescript
 * const config: PerformanceConfig = {
 *   metrics: ['cpu', 'memory', 'gpu', 'latency'],
 *   interval: 5000,
 *   retention: 86400,
 *   thresholds: {
 *     cpu: 0.9,
 *     memory: 0.8,
 *     latency: 0.1
 *   }
 * };
 * ```
 */
export interface PerformanceConfig {
  samplingInterval: number;
  retentionPeriod: number;
  alertThresholds: {
    cpu: number;
    memory: number;
    gpu?: number;
    latency: number;
    errorRate: number;
  };
  metricsToTrack: Array<'training' | 'inference' | 'health' | 'resources'>;
  storage: {
    type: 'memory' | 'disk' | 'database';
    maxSize?: number;
    compression?: boolean;
  };
}

/**
 * Performance report interface
 */
export interface PerformanceReport {
  timestamp: number;
  duration: number;
  summary: {
    averageLatency: number;
    peakMemoryUsage: number;
    totalPredictions: number;
    successRate: number;
  };
  metrics: {
    training?: TrainingMetrics[];
    inference?: InferenceMetrics[];
    health?: ModelHealthMetrics[];
    resources?: ResourceMetrics[];
  };
  recommendations?: Array<{
    type: 'optimization' | 'scaling' | 'maintenance';
    priority: 'high' | 'medium' | 'low';
    description: string;
    impact: string;
  }>;
}

export type PerformanceEvent = {
  type: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
};

/**
 * System health metrics.
 * Tracks overall system performance and health indicators.
 * 
 * @example
 * ```typescript
 * const health: SystemHealth = {
 *   status: 'healthy',
 *   uptime: 3600,
 *   lastCheck: Date.now(),
 *   metrics: {
 *     cpu: 0.7,
 *     memory: 0.6,
 *     disk: 0.4,
 *     network: 0.3
 *   },
 *   alerts: []
 * };
 * ```
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  lastCheck: number;
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: number;
  }>;
}

/**
 * Performance benchmark results.
 * Contains results from performance testing and benchmarking.
 * 
 * @example
 * ```typescript
 * const benchmark: BenchmarkResults = {
 *   testId: 'inference-speed-v1',
 *   timestamp: Date.now(),
 *   results: {
 *     averageLatency: 0.05,
 *     maxLatency: 0.12,
 *     throughput: 100,
 *     accuracy: 0.95
 *   },
 *   environment: {
 *     cpu: 'Intel i7-9700K',
 *     gpu: 'NVIDIA RTX 2080',
 *     memory: '32GB',
 *     os: 'Linux 5.4.0'
 *   }
 * };
 * ```
 */
export interface BenchmarkResults {
  testId: string;
  timestamp: number;
  results: {
    averageLatency: number;
    maxLatency: number;
    throughput: number;
    accuracy: number;
  };
  environment: {
    cpu: string;
    gpu?: string;
    memory: string;
    os: string;
  };
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  latency: number;
  accuracy: number;
  throughput: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    gpu?: number;
  };
  errorRate: number;
  successRate: number;
  confidence: number;
} 