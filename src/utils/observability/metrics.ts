import { Counter, Gauge, Histogram } from "prom-client";
import logger from "./logger";

// Define metrics
export const metrics = {
  // Bot performance metrics
  botUptime: new Gauge({
    name: "bot_uptime_seconds",
    help: "Bot uptime in seconds",
  }),
  tasksCompleted: new Counter({
    name: "tasks_completed_total",
    help: "Total number of completed tasks",
    labelNames: ["task_type"],
  }),
  tasksFailed: new Counter({
    name: "tasks_failed_total",
    help: "Total number of failed tasks",
    labelNames: ["task_type", "error_type"],
  }),
  taskDuration: new Histogram({
    name: "task_duration_seconds",
    help: "Duration of tasks in seconds",
    labelNames: ["task_type"],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  }),

  // Command metrics
  commandLatency: new Histogram({
    name: "bot_command_latency_ms",
    help: "Latency in ms for command parsing",
    labelNames: ["command_type", "status"] as const,
    buckets: [50, 100, 200, 500, 1000, 2000],
  }),
  commandRetries: new Counter({
    name: "bot_command_retries",
    help: "Number of command retries",
    labelNames: ["command_type", "status"] as const,
  }),

  // Cache metrics
  cacheSize: new Gauge({
    name: "bot_cache_size",
    help: "Current number of entries in cache",
  }),
  cacheHitRate: new Gauge({
    name: "bot_cache_hit_rate",
    help: "Current cache hit rate",
  }),
  cacheEvictions: new Counter({
    name: "bot_cache_evictions_total",
    help: "Total number of cache evictions",
  }),

  // Queue metrics
  queueLength: new Gauge({
    name: "bot_command_queue_length",
    help: "Current length of command queue",
  }),
  queueProcessingTime: new Histogram({
    name: "bot_queue_processing_time_ms",
    help: "Time spent processing queue items",
    labelNames: ["status"] as const,
    buckets: [10, 50, 100, 500, 1000, 5000],
  }),

  // Minecraft-specific metrics
  blocksMined: new Counter({
    name: "blocks_mined_total",
    help: "Total number of blocks mined",
    labelNames: ["block_type"],
  }),
  itemsCollected: new Counter({
    name: "items_collected_total",
    help: "Total number of items collected",
    labelNames: ["item_type"],
  }),
  health: new Gauge({
    name: "bot_health",
    help: "Bot health points",
  }),
  food: new Gauge({
    name: "bot_food",
    help: "Bot food level",
  }),
  redstoneStates: new Gauge({
    name: "redstone_states",
    help: "Current state of redstone devices",
    labelNames: ["device_type", "position"],
  }),

  // LLM metrics
  llmRequests: new Counter({
    name: "llm_requests_total",
    help: "Total number of LLM requests",
    labelNames: ["model"],
  }),
  llmLatency: new Histogram({
    name: "llm_request_duration_seconds",
    help: "Duration of LLM requests in seconds",
    labelNames: ["model"],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),
};

// ML-specific metrics
export const mlMetrics = {
  stateUpdates: new Counter({
    name: "ml_state_updates_total",
    help: "Total number of ML state updates",
    labelNames: ["type"] as const,
  }),
  predictionAccuracy: new Gauge({
    name: "ml_prediction_accuracy",
    help: "Accuracy of ML predictions",
    labelNames: ["type"] as const,
  }),
  predictionLatency: new Histogram({
    name: "ml_prediction_latency_seconds",
    help: "Latency of ML predictions in seconds",
    labelNames: ["type"] as const,
  }),
  errors: new Counter({
    name: "ml_errors_total",
    help: "Total number of ML errors",
    labelNames: ["type"] as const,
  }),
  predictionSuccess: new Counter({
    name: "ml_prediction_success_total",
    help: "Total number of successful ML predictions",
    labelNames: ["type", "success"] as const,
  }),
  predictionConfidence: new Gauge({
    name: "ml_prediction_confidence",
    help: "Confidence of ML predictions",
    labelNames: ["type"] as const,
  }),
  redstoneEfficiency: new Gauge({
    name: "redstone_efficiency",
    help: "Current efficiency of redstone circuits",
  }),
  redstonePowerUsage: new Gauge({
    name: "redstone_power_usage",
    help: "Current power usage of redstone circuits",
  }),
  circuitOptimizationTime: new Histogram({
    name: "redstone_circuit_optimization_time_ms",
    help: "Time taken to optimize redstone circuits",
    buckets: [10, 50, 100, 500, 1000, 5000],
  }),
  farmOptimizationTime: new Histogram({
    name: "redstone_farm_optimization_time_ms",
    help: "Time taken to optimize redstone farms",
    buckets: [10, 50, 100, 500, 1000, 5000],
  }),
  powerFlowOptimization: new Gauge({
    name: "redstone_power_flow_optimization",
    help: "Current power flow optimization score",
  }),
  devicePlacementScore: new Gauge({
    name: "redstone_device_placement_score",
    help: "Current device placement optimization score",
  }),
  updateIntervalEfficiency: new Gauge({
    name: "redstone_update_interval_efficiency",
    help: "Current update interval optimization efficiency",
  }),
  farmEfficiency: new Gauge({
    name: "redstone_farm_efficiency",
    help: "Current farm optimization efficiency",
  }),
};

// Initialize metrics
export function initializeMetrics() {
  // Start uptime counter
  setInterval(() => {
    metrics.botUptime.inc(1);
  }, 1000);

  logger.info("Metrics initialized");
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
    metrics.tasksFailed.inc({
      task_type: taskType,
      error_type: errorType || "unknown",
    });
  }
  metrics.taskDuration.observe({ task_type: taskType }, duration);
}
