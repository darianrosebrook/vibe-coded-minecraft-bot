import { TaskParsingLogger } from "../logging/logger";

interface PerformanceMetrics {
  totalRequests: number;
  totalTokens: number;
  averageResponseTime: number;
  errorCount: number;
  cacheHitRate: number;
  tokenUsageByCommand: Map<string, number>;
  responseTimes: number[];
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private logger: TaskParsingLogger;
  private startTime: number;

  constructor() {
    this.metrics = {
      totalRequests: 0,
      totalTokens: 0,
      averageResponseTime: 0,
      errorCount: 0,
      cacheHitRate: 0,
      tokenUsageByCommand: new Map(),
      responseTimes: [],
    };
    this.logger = new TaskParsingLogger();
    this.startTime = Date.now();
  }

  public startRequest(command: string): number {
    return Date.now();
  }

  public endRequest(
    startTime: number,
    command: string,
    tokenUsage?: TokenUsage,
    cacheHit: boolean = false
  ): void {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Update metrics
    this.metrics.totalRequests++;
    this.metrics.responseTimes.push(responseTime);
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) +
        responseTime) /
      this.metrics.totalRequests;

    if (tokenUsage) {
      this.metrics.totalTokens += tokenUsage.totalTokens;
      const currentUsage = this.metrics.tokenUsageByCommand.get(command) || 0;
      this.metrics.tokenUsageByCommand.set(
        command,
        currentUsage + tokenUsage.totalTokens
      );
    }

    // Log performance data
    this.logger.logPerformance({
      command,
      responseTime,
      tokenUsage,
      cacheHit,
      timestamp: endTime,
    });
  }

  public recordError(): void {
    this.metrics.errorCount++;
  }

  public updateCacheHitRate(hitRate: number): void {
    this.metrics.cacheHitRate = hitRate;
  }

  public getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      tokenUsageByCommand: new Map(this.metrics.tokenUsageByCommand),
    };
  }

  public getUptime(): number {
    return Date.now() - this.startTime;
  }

  public getAverageResponseTime(): number {
    return this.metrics.averageResponseTime;
  }

  public getTokenUsageByCommand(): Map<string, number> {
    return new Map(this.metrics.tokenUsageByCommand);
  }

  public getErrorRate(): number {
    return this.metrics.errorCount / this.metrics.totalRequests;
  }

  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      totalTokens: 0,
      averageResponseTime: 0,
      errorCount: 0,
      cacheHitRate: 0,
      tokenUsageByCommand: new Map(),
      responseTimes: [],
    };
    this.startTime = Date.now();
  }
}
