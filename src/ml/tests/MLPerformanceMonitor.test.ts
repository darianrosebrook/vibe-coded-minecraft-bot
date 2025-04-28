import { MLPerformanceMonitor } from '../performance/MLPerformanceMonitor';

describe('MLPerformanceMonitor Tests', () => {
  let monitor: MLPerformanceMonitor;

  beforeEach(() => {
    monitor = new MLPerformanceMonitor();
  });

  describe('Performance Measurement', () => {
    it('should measure basic performance metrics', async () => {
      const metrics = await monitor.measurePerformance('testModel');
      
      expect(metrics).toBeDefined();
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.resourceUtilization).toBeDefined();
      expect(metrics.scalability).toBeDefined();
      expect(metrics.efficiency).toBeDefined();
    });

    it('should track metrics history', async () => {
      await monitor.measurePerformance('testModel');
      await monitor.measurePerformance('testModel');
      
      const history = monitor.getMetricsHistory('testModel');
      expect(history).toHaveLength(2);
    });

    it('should calculate average metrics', async () => {
      await monitor.measurePerformance('testModel');
      await monitor.measurePerformance('testModel');
      
      const averages = monitor.getAverageMetrics('testModel');
      expect(averages).toBeDefined();
      expect(averages?.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(averages?.memoryUsage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Monitoring', () => {
    it('should measure CPU usage', () => {
      const cpuUsage = monitor['getCPUUsage']();
      expect(cpuUsage).toBeGreaterThanOrEqual(0);
      expect(cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should measure memory usage', () => {
      const memoryUsage = monitor['getMemoryUsage']();
      expect(memoryUsage).toBeGreaterThanOrEqual(0);
      expect(memoryUsage).toBeLessThanOrEqual(100);
    });

    it('should measure memory growth', () => {
      const memoryGrowth = monitor['getMemoryGrowth']();
      expect(memoryGrowth).toBeDefined();
    });

    it('should measure memory efficiency', () => {
      const memoryEfficiency = monitor['getMemoryEfficiency']();
      expect(memoryEfficiency).toBeGreaterThanOrEqual(0);
      expect(memoryEfficiency).toBeLessThanOrEqual(100);
    });
  });

  describe('Metrics Management', () => {
    it('should reset metrics for a model', async () => {
      await monitor.measurePerformance('testModel');
      monitor.resetMetrics('testModel');
      
      const history = monitor.getMetricsHistory('testModel');
      expect(history).toHaveLength(0);
    });

    it('should handle multiple models', async () => {
      await monitor.measurePerformance('model1');
      await monitor.measurePerformance('model2');
      
      const history1 = monitor.getMetricsHistory('model1');
      const history2 = monitor.getMetricsHistory('model2');
      
      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
    });
  });

  describe('Performance Analysis', () => {
    it('should calculate weighted performance scores', async () => {
      const metrics = await monitor.measurePerformance('testModel');
      
      // Check that all required metrics are present
      expect(metrics.resourceUtilization.cpu).toBeDefined();
      expect(metrics.resourceUtilization.memory).toBeDefined();
      expect(metrics.scalability.memoryGrowth).toBeDefined();
      expect(metrics.efficiency.memoryEfficiency).toBeDefined();
    });

    it('should handle missing optional metrics', async () => {
      const metrics = await monitor.measurePerformance('testModel');
      
      // GPU and disk usage are optional
      expect(metrics.resourceUtilization.gpu).toBeUndefined();
      expect(metrics.resourceUtilization.disk).toBeUndefined();
      expect(metrics.efficiency.energyEfficiency).toBeUndefined();
    });
  });
}); 