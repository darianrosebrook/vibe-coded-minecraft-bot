import logger from './logger';
import { EventEmitter } from 'events';

export interface PerformanceEvent {
  type: 'task' | 'command' | 'scan' | 'cache' | 'queue';
  name: string;
  duration: number;
  success: boolean;
  errorType?: string;
  correlationId?: string;
  metadata: Record<string, any>;
  timestamp: number;
}

export class PerformanceTracker extends EventEmitter {
  private startTimes: Map<string, number> = new Map();
  private longRunningThreshold: number = 5000; // 5 seconds
  private events: PerformanceEvent[] = [];

  constructor() {
    super();
  }

  public startTracking(operation: string): void {
    this.startTimes.set(operation, Date.now());
    logger.info(`Starting operation: ${operation}`);
  }

  public endTracking(operation: string): void {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      logger.warn(`No start time found for operation: ${operation}`);
      return;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(operation);

    this.trackEvent({
      type: 'task',
      name: operation,
      duration,
      success: true,
      metadata: {},
      timestamp: Date.now()
    });

    if (duration > this.longRunningThreshold) {
      logger.warn(`Long running operation detected: ${operation} took ${duration}ms`);
    } else {
      logger.info(`Operation completed: ${operation} took ${duration}ms`);
    }
  }

  public trackEvent(event: PerformanceEvent): void {
    this.events.push(event);
    this.emit('performanceEvent', event);

    if (!event.success) {
      logger.warn(`Performance event failed: ${event.name}`, {
        type: event.type,
        duration: event.duration,
        errorType: event.errorType,
        correlationId: event.correlationId,
        metadata: event.metadata
      });
    }
  }

  public trackAsync<T>(operation: string, promise: Promise<T>): Promise<T> {
    this.startTracking(operation);
    return promise.finally(() => this.endTracking(operation));
  }

  public getMetrics() {
    const eventsByType = new Map<string, PerformanceEvent[]>();
    for (const event of this.events) {
      const events = eventsByType.get(event.type) || [];
      events.push(event);
      eventsByType.set(event.type, events);
    }

    const metrics: Record<string, any> = {};
    for (const [type, events] of eventsByType.entries()) {
      const successful = events.filter(e => e.success);
      metrics[`${type}Metrics`] = {
        successRate: successful.length / events.length,
        averageDuration: events.reduce((acc, e) => acc + e.duration, 0) / events.length || 0,
        totalExecutions: events.length
      };
    }

    return metrics;
  }

  public getPerformanceDataForML() {
    const metrics = this.getMetrics();
    const correlatedEvents: Record<string, PerformanceEvent[]> = {};

    for (const event of this.events) {
      if (event.correlationId) {
        const events = correlatedEvents[event.correlationId] || [];
        events.push(event);
        correlatedEvents[event.correlationId] = events;
      }
    }

    return {
      features: {
        ...metrics,
        totalEvents: this.events.length
      },
      labels: {},
      correlatedEvents
    };
  }
} 