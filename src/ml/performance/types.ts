export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  inferenceTime: number;
  trainingTime: number;
  batchProcessingTime: number;
  modelSize: number;
  throughput: number;
  errorRate: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    gpu?: number;
    disk?: number;
  };
  scalability: {
    batchSize: number;
    processingTime: number;
    memoryGrowth: number;
  };
  efficiency: {
    operationsPerSecond: number;
    memoryEfficiency: number;
    energyEfficiency?: number;
  };
} 