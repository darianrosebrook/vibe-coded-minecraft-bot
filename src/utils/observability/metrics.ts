import { Counter, Gauge, Histogram } from 'prom-client';
import logger from './logger';

// Define metrics
export const metrics = {
  // Bot performance metrics
  botUptime: new Gauge({
    name: 'bot_uptime_seconds',
    help: 'Bot uptime in seconds',
  }),
  tasksCompleted: new Counter({
    name: 'tasks_completed_total',
    help: 'Total number of completed tasks',
    labelNames: ['task_type'],
  }),
  tasksFailed: new Counter({
    name: 'tasks_failed_total',
    help: 'Total number of failed tasks',
    labelNames: ['task_type', 'error_type'],
  }),
  taskDuration: new Histogram({
    name: 'task_duration_seconds',
    help: 'Duration of tasks in seconds',
    labelNames: ['task_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  }),

  // Minecraft-specific metrics
  blocksMined: new Counter({
    name: 'blocks_mined_total',
    help: 'Total number of blocks mined',
    labelNames: ['block_type'],
  }),
  itemsCollected: new Counter({
    name: 'items_collected_total',
    help: 'Total number of items collected',
    labelNames: ['item_type'],
  }),
  health: new Gauge({
    name: 'bot_health',
    help: 'Bot health points',
  }),
  food: new Gauge({
    name: 'bot_food',
    help: 'Bot food level',
  }),
  redstoneStates: new Gauge({
    name: 'redstone_states',
    help: 'Current state of redstone devices',
    labelNames: ['device_type', 'position'],
  }),

  // LLM metrics
  llmRequests: new Counter({
    name: 'llm_requests_total',
    help: 'Total number of LLM requests',
    labelNames: ['model'],
  }),
  llmLatency: new Histogram({
    name: 'llm_request_duration_seconds',
    help: 'Duration of LLM requests in seconds',
    labelNames: ['model'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),
};

// ML-specific metrics
export const mlMetrics = {
  stateUpdates: new Counter({
    name: 'ml_state_updates_total',
    help: 'Total number of ML state updates',
    labelNames: ['type'] as const
  }),
  predictionAccuracy: new Gauge({
    name: 'ml_prediction_accuracy',
    help: 'Accuracy of ML predictions',
    labelNames: ['type'] as const
  }),
  predictionLatency: new Histogram({
    name: 'ml_prediction_latency_seconds',
    help: 'Latency of ML predictions in seconds',
    labelNames: ['type'] as const
  }),
  errors: new Counter({
    name: 'ml_errors_total',
    help: 'Total number of ML errors',
    labelNames: ['type'] as const
  }),
  predictionSuccess: new Counter({
    name: 'ml_prediction_success_total',
    help: 'Total number of successful ML predictions',
    labelNames: ['type', 'success'] as const
  }),
  predictionConfidence: new Gauge({
    name: 'ml_prediction_confidence',
    help: 'Confidence of ML predictions',
    labelNames: ['type'] as const
  })
};

// Initialize metrics
export function initializeMetrics() {
  // Start uptime counter
  setInterval(() => {
    metrics.botUptime.inc(1);
  }, 1000);

  logger.info('Metrics initialized');
}

// Helper function to record task metrics
export function recordTaskMetrics(
  taskType: string,
  duration: number,
  success: boolean,
  errorType?: string
) {
  if (success) {
    metrics.tasksCompleted.inc({ task_type: taskType });
  } else {
    metrics.tasksFailed.inc({ task_type: taskType, error_type: errorType || 'unknown' });
  }
  metrics.taskDuration.observe({ task_type: taskType }, duration);
} 