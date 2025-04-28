import { EventEmitter } from 'events';
import logger from '../../utils/observability/logger';
import { metrics } from '../../utils/observability/metrics'; 
import { v4 as uuidv4 } from 'uuid';

// Performance event types
export type PerformanceEvent = {
  type: 'task' | 'command' | 'scan' | 'cache' | 'queue';
  name: string;
  duration: number;
  success: boolean;
  errorType?: string;
  correlationId?: string;
  metadata: Record<string, any>;
  timestamp: number;
};

// Performance metrics
export type PerformanceMetrics = {
  taskMetrics: {
    successRate: number;
    averageDuration: number;
    totalExecutions: number;
  };
  commandMetrics: {
    successRate: number;
    averageDuration: number;
    queueLength: number;
  };
  scanMetrics: {
    averageDuration: number;
    cacheHitRate: number;
    totalScans: number;
  };
  cacheMetrics: {
    hitRate: number;
    size: number;
    evictionRate: number;
  };
};

export class PerformanceTracker extends EventEmitter {
  private events: PerformanceEvent[] = [];
  private readonly maxEvents: number = 1000;
  private readonly windowSize: number = 60 * 1000; // 1 minute window
  private correlationMap: Map<string, PerformanceEvent[]> = new Map();

  constructor() {
    super();
    this.setupMetrics();
  }

  private setupMetrics() {
    // Task metrics are already defined in metrics object
    // Command metrics are already defined in metrics object
    // Cache metrics are already defined in metrics object
    // Queue metrics are already defined in metrics object
  }

  public trackEvent(event: PerformanceEvent): void {
    // Generate correlation ID if not present
    if (!event.correlationId) {
      event.correlationId = uuidv4();
    }

    // Add event to history
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Track correlated events
    if (event.correlationId) {
      const correlatedEvents = this.correlationMap.get(event.correlationId) || [];
      correlatedEvents.push(event);
      this.correlationMap.set(event.correlationId, correlatedEvents);
    }

    // Update metrics
    this.updateMetrics(event);

    // Emit event for ML systems
    this.emit('performanceEvent', event);

    // Log if significant performance issue
    if (event.duration > 1000) { // Log if operation took more than 1 second
      logger.warn('Performance warning', {
        eventType: event.type,
        eventName: event.name,
        duration: event.duration,
        errorType: event.errorType,
        correlationId: event.correlationId,
        metadata: event.metadata
      });
    }
  }

  private updateMetrics(event: PerformanceEvent): void {
    switch (event.type) {
      case 'task':
        metrics.taskDuration.observe(
          { 
            task_type: event.name
          },
          event.duration
        );
        if (event.success) {
          metrics.tasksCompleted.inc({ task_type: event.name });
        } else {
          metrics.tasksFailed.inc({ 
            task_type: event.name,
            error_type: event.errorType || 'unknown'
          });
        }
        break;
      case 'command':
        metrics.commandLatency.observe(
          { 
            command_type: event.name
          },
          event.duration
        );
        break;
      case 'cache':
        metrics.cacheSize.set(event.metadata.size || 0);
        if (event.name === 'eviction') {
          metrics.cacheEvictions.inc();
        }
        break;
      case 'queue':
        
        break;
    }
  }

  public getCorrelatedEvents(correlationId: string): PerformanceEvent[] {
    return this.correlationMap.get(correlationId) || [];
  }

  public getMetrics(windowMs: number = this.windowSize): PerformanceMetrics {
    const now = Date.now();
    const windowEvents = this.events.filter(e => now - e.timestamp <= windowMs);

    return {
      taskMetrics: this.calculateTaskMetrics(windowEvents),
      commandMetrics: this.calculateCommandMetrics(windowEvents),
      scanMetrics: this.calculateScanMetrics(windowEvents),
      cacheMetrics: this.calculateCacheMetrics(windowEvents)
    };
  }

  private calculateTaskMetrics(events: PerformanceEvent[]) {
    const taskEvents = events.filter(e => e.type === 'task');
    const successfulTasks = taskEvents.filter(e => e.success);
    
    return {
      successRate: taskEvents.length ? successfulTasks.length / taskEvents.length : 0,
      averageDuration: taskEvents.length ? 
        taskEvents.reduce((sum, e) => sum + e.duration, 0) / taskEvents.length : 0,
      totalExecutions: taskEvents.length
    };
  }

  private calculateCommandMetrics(events: PerformanceEvent[]) {
    const commandEvents = events.filter(e => e.type === 'command');
    const successfulCommands = commandEvents.filter(e => e.success);
    
    return {
      successRate: commandEvents.length ? successfulCommands.length / commandEvents.length : 0,
      averageDuration: commandEvents.length ? 
        commandEvents.reduce((sum, e) => sum + e.duration, 0) / commandEvents.length : 0,
      queueLength: commandEvents.filter(e => e.name === 'queue_length').length
    };
  }

  private calculateScanMetrics(events: PerformanceEvent[]) {
    const scanEvents = events.filter(e => e.type === 'scan');
    const cacheHits = scanEvents.filter(e => e.metadata.cacheHit).length;
    
    return {
      averageDuration: scanEvents.length ? 
        scanEvents.reduce((sum, e) => sum + e.duration, 0) / scanEvents.length : 0,
      cacheHitRate: scanEvents.length ? cacheHits / scanEvents.length : 0,
      totalScans: scanEvents.length
    };
  }

  private calculateCacheMetrics(events: PerformanceEvent[]) {
    const cacheEvents = events.filter(e => e.type === 'cache');
    const hits = cacheEvents.filter(e => e.name === 'hit').length;
    const evictions = cacheEvents.filter(e => e.name === 'eviction').length;
    
    return {
      hitRate: cacheEvents.length ? hits / cacheEvents.length : 0,
      size: cacheEvents.find(e => e.name === 'size')?.metadata.value || 0,
      evictionRate: cacheEvents.length ? evictions / cacheEvents.length : 0
    };
  }

  public getPerformanceDataForML(): {
    features: Record<string, number>;
    labels: Record<string, number>;
    correlatedEvents: Record<string, PerformanceEvent[]>;
  } {
    const metrics = this.getMetrics();
    
    return {
      features: {
        taskSuccessRate: metrics.taskMetrics.successRate,
        taskAvgDuration: metrics.taskMetrics.averageDuration,
        commandSuccessRate: metrics.commandMetrics.successRate,
        commandAvgDuration: metrics.commandMetrics.averageDuration,
        cacheHitRate: metrics.cacheMetrics.hitRate,
        queueLength: metrics.commandMetrics.queueLength
      },
      labels: {
        overallPerformance: (
          metrics.taskMetrics.successRate * 0.4 +
          metrics.commandMetrics.successRate * 0.3 +
          metrics.cacheMetrics.hitRate * 0.3
        )
      },
      correlatedEvents: Object.fromEntries(this.correlationMap)
    };
  }
} 