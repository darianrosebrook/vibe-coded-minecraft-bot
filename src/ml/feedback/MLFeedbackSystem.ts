import { EnhancedGameState } from '../state/types';
import { TaskHistory } from '../state/types';
import { CommandPattern } from '../command/types';
import { PerformanceMetrics } from '../performance/types';

export interface FeedbackData {
  taskId: string;
  success: boolean;
  executionTime: number;
  stateBefore: EnhancedGameState;
  stateAfter: EnhancedGameState;
  error?: string;
  recoveryAttempts?: number;
  commandPattern?: CommandPattern;
  performanceMetrics?: PerformanceMetrics;
  context: Record<string, any>;
}

export interface LearningMetrics {
  successRate: number;
  averageExecutionTime: number;
  errorRate: number;
  recoverySuccessRate: number;
  patternConfidence: number;
  performanceScore: number;
}

export interface ModelUpdateTrigger {
  successRateThreshold: number;
  performanceThreshold: number;
  errorRateThreshold: number;
  minDataPoints: number;
  updateInterval: number;
}

export class MLFeedbackSystem {
  private feedbackQueue: FeedbackData[] = [];
  private modelVersions: Map<string, number> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  private learningMetrics: Map<string, LearningMetrics> = new Map();
  private lastUpdateTime: Map<string, number> = new Map();
  private updateTriggers: Map<string, ModelUpdateTrigger> = new Map();

  constructor() {
    this.initializeDefaultTriggers();
  }

  private initializeDefaultTriggers(): void {
    const defaultTrigger: ModelUpdateTrigger = {
      successRateThreshold: 0.8,
      performanceThreshold: 0.7,
      errorRateThreshold: 0.2,
      minDataPoints: 50,
      updateInterval: 3600000 // 1 hour in milliseconds
    };
    this.updateTriggers.set('default', defaultTrigger);
  }

  public async processFeedback(feedback: FeedbackData): Promise<void> {
    this.feedbackQueue.push(feedback);
    await this.analyzeFeedback(feedback);
    await this.updateLearningMetrics(feedback.taskId);
  }

  private async analyzeFeedback(feedback: FeedbackData): Promise<void> {
    const metrics = await this.calculateMetrics(feedback.taskId);
    this.learningMetrics.set(feedback.taskId, metrics);
    
    if (await this.shouldUpdateModel(feedback.taskId, metrics)) {
      await this.triggerModelUpdate(feedback.taskId);
    }
  }

  private async calculateMetrics(taskId: string): Promise<LearningMetrics> {
    const relevantFeedback = this.feedbackQueue.filter(f => f.taskId === taskId);
    const successes = relevantFeedback.filter(f => f.success).length;
    const errors = relevantFeedback.filter(f => f.error).length;
    const recoveries = relevantFeedback.filter(f => f.recoveryAttempts && f.recoveryAttempts > 0).length;
    const successfulRecoveries = relevantFeedback.filter(f => f.recoveryAttempts && f.recoveryAttempts > 0 && f.success).length;

    return {
      successRate: relevantFeedback.length > 0 ? successes / relevantFeedback.length : 0,
      averageExecutionTime: this.calculateAverageExecutionTime(relevantFeedback),
      errorRate: relevantFeedback.length > 0 ? errors / relevantFeedback.length : 0,
      recoverySuccessRate: recoveries > 0 ? successfulRecoveries / recoveries : 0,
      patternConfidence: this.calculatePatternConfidence(relevantFeedback),
      performanceScore: this.calculatePerformanceScore(relevantFeedback)
    };
  }

  private calculateAverageExecutionTime(feedback: FeedbackData[]): number {
    if (feedback.length === 0) return 0;
    const totalTime = feedback.reduce((sum, f) => sum + f.executionTime, 0);
    return totalTime / feedback.length;
  }

  private calculatePatternConfidence(feedback: FeedbackData[]): number {
    if (feedback.length === 0) return 0;
    const patterns = feedback.filter(f => f.commandPattern).map(f => f.commandPattern!);
    const uniquePatterns = new Set(patterns.map(p => JSON.stringify(p)));
    return uniquePatterns.size / patterns.length;
  }

  private calculatePerformanceScore(feedback: FeedbackData[]): number {
    if (feedback.length === 0) return 0;
    const scores = feedback
      .filter(f => f.performanceMetrics)
      .map(f => this.normalizePerformanceMetrics(f.performanceMetrics!));
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  private normalizePerformanceMetrics(metrics: PerformanceMetrics): number {
    // Implement normalization logic based on your performance metrics
    return 0.5; // Placeholder
  }

  private async shouldUpdateModel(taskId: string, metrics: LearningMetrics): Promise<boolean> {
    const trigger = this.updateTriggers.get(taskId) || this.updateTriggers.get('default')!;
    const lastUpdate = this.lastUpdateTime.get(taskId) || 0;
    const now = Date.now();

    if (now - lastUpdate < trigger.updateInterval) {
      return false;
    }

    const hasEnoughData = this.feedbackQueue.filter(f => f.taskId === taskId).length >= trigger.minDataPoints;
    const meetsSuccessThreshold = metrics.successRate < trigger.successRateThreshold;
    const meetsPerformanceThreshold = metrics.performanceScore < trigger.performanceThreshold;
    const meetsErrorThreshold = metrics.errorRate > trigger.errorRateThreshold;

    return hasEnoughData && (meetsSuccessThreshold || meetsPerformanceThreshold || meetsErrorThreshold);
  }

  private async triggerModelUpdate(taskId: string): Promise<void> {
    const currentVersion = this.modelVersions.get(taskId) || 0;
    this.modelVersions.set(taskId, currentVersion + 1);
    this.lastUpdateTime.set(taskId, Date.now());
    
    // Implement model retraining logic here
    await this.retrainModel(taskId);
  }

  private async retrainModel(taskId: string): Promise<void> {
    // Implement model retraining logic
    // This would involve:
    // 1. Preparing training data from feedback
    // 2. Training the model
    // 3. Validating the new model
    // 4. Deploying the updated model
  }

  public getModelVersion(taskId: string): number {
    return this.modelVersions.get(taskId) || 0;
  }

  public getLearningMetrics(taskId: string): LearningMetrics | undefined {
    return this.learningMetrics.get(taskId);
  }

  public setUpdateTrigger(taskId: string, trigger: ModelUpdateTrigger): void {
    this.updateTriggers.set(taskId, trigger);
  }

  private async updateLearningMetrics(taskId: string): Promise<void> {
    const metrics = await this.calculateMetrics(taskId);
    this.learningMetrics.set(taskId, metrics);
    
    // Update performance metrics
    const performanceData = this.feedbackQueue
      .filter(f => f.taskId === taskId && f.performanceMetrics)
      .map(f => f.performanceMetrics!);
    
    if (performanceData.length > 0) {
      const avgPerformance = this.calculateAveragePerformance(performanceData);
      this.performanceMetrics.set(taskId, [
        ...(this.performanceMetrics.get(taskId) || []),
        avgPerformance
      ]);
    }
  }

  private calculateAveragePerformance(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const weights = {
      cpuUsage: 0.2,
      memoryUsage: 0.2,
      networkLatency: 0.1,
      inferenceTime: 0.2,
      throughput: 0.2,
      errorRate: 0.1
    };
    
    const normalizedMetrics = metrics.map(m => ({
      cpuUsage: m.cpuUsage / 100,
      memoryUsage: m.memoryUsage / 100,
      networkLatency: Math.min(m.networkLatency / 1000, 1),
      inferenceTime: Math.min(m.inferenceTime / 1000, 1),
      throughput: m.throughput / 1000,
      errorRate: m.errorRate
    }));
    
    const weightedSum = normalizedMetrics.reduce((sum, m) => {
      return sum + (
        (1 - m.cpuUsage) * weights.cpuUsage +
        (1 - m.memoryUsage) * weights.memoryUsage +
        (1 - m.networkLatency) * weights.networkLatency +
        (1 - m.inferenceTime) * weights.inferenceTime +
        m.throughput * weights.throughput +
        (1 - m.errorRate) * weights.errorRate
      );
    }, 0);
    
    return weightedSum / metrics.length;
  }
} 