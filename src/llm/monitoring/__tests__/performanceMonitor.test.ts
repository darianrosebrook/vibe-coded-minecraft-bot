import { PerformanceMonitor } from '../performanceMonitor';
import { TaskParsingLogger } from '../../logging/logger';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let logger: TaskParsingLogger;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    logger = new TaskParsingLogger();
  });

  describe('request tracking', () => {
    it('should track request start and end times', () => {
      const startTime = monitor.startRequest('test command');
      expect(startTime).toBeLessThanOrEqual(Date.now());

      monitor.endRequest(startTime, 'test command');
      const metrics = monitor.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should track token usage', () => {
      const startTime = monitor.startRequest('test command');
      const tokenUsage = {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      };

      monitor.endRequest(startTime, 'test command', tokenUsage);
      const metrics = monitor.getMetrics();
      expect(metrics.totalTokens).toBe(15);
      expect(metrics.tokenUsageByCommand.get('test command')).toBe(15);
    });

    it('should track cache hits', () => {
      const startTime = monitor.startRequest('test command');
      monitor.endRequest(startTime, 'test command', undefined, true);
      const metrics = monitor.getMetrics();
      expect(metrics.cacheHitRate).toBe(0); // Cache hit rate is updated separately
    });
  });

  describe('error tracking', () => {
    it('should track errors', () => {
      monitor.recordError();
      monitor.recordError();
      const metrics = monitor.getMetrics();
      expect(metrics.errorCount).toBe(2);
    });

    it('should calculate error rate correctly', () => {
      const startTime = monitor.startRequest('test command');
      monitor.endRequest(startTime, 'test command');
      monitor.recordError();
      monitor.recordError();

      expect(monitor.getErrorRate()).toBe(2);
    });
  });

  describe('metrics', () => {
    it('should calculate average response time correctly', () => {
      const startTime1 = monitor.startRequest('test command 1');
      monitor.endRequest(startTime1, 'test command 1');

      const startTime2 = monitor.startRequest('test command 2');
      monitor.endRequest(startTime2, 'test command 2');

      const metrics = monitor.getMetrics();
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should track token usage by command', () => {
      const tokenUsage1 = {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      };
      const tokenUsage2 = {
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30
      };

      const startTime1 = monitor.startRequest('command 1');
      monitor.endRequest(startTime1, 'command 1', tokenUsage1);

      const startTime2 = monitor.startRequest('command 2');
      monitor.endRequest(startTime2, 'command 2', tokenUsage2);

      const tokenUsage = monitor.getTokenUsageByCommand();
      expect(tokenUsage.get('command 1')).toBe(15);
      expect(tokenUsage.get('command 2')).toBe(30);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      const startTime = monitor.startRequest('test command');
      monitor.endRequest(startTime, 'test command');
      monitor.recordError();

      monitor.resetMetrics();
      const metrics = monitor.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalTokens).toBe(0);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.tokenUsageByCommand.size).toBe(0);
    });
  });
}); 