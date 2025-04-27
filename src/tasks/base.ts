import { Bot as MineflayerBot } from 'mineflayer';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Task, BaseTaskInterface, TaskProgress, TaskResult, TaskParameters, TaskStatus } from '../types/task';
import { CommandHandler } from '../commands';
import { TaskStorage, StorageConfig } from '../storage/taskStorage';
import { ErrorHandler, ErrorContext } from '../error/errorHandler';
import { MinecraftBot } from '../bot/bot';
import { Position } from '../types/common';

export interface BaseTaskOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export type TaskOptions = TaskParameters & BaseTaskOptions;

export abstract class BaseTask implements BaseTaskInterface {
  protected bot: MinecraftBot;
  protected mineflayerBot: MineflayerBot;
  protected commandHandler: CommandHandler;
  protected taskId: string | null = null;
  protected totalProgress: number = 0;
  protected currentProgress: number = 0;
  protected progressSteps: number = 0;
  protected currentStep: number = 0;
  protected startTime: number = 0;
  protected endTime: number = 0;
  protected status: TaskProgress['status'] = TaskStatus.PENDING;
  protected estimatedTimeRemaining: number = 0;
  protected lastProgressUpdate: number = 0;
  protected progressHistory: Array<{ timestamp: number; progress: number }> = [];
  protected currentLocation: Position | null = null;
  protected errorCount: number = 0;
  protected retryCount: number = 0;
  protected maxRetries: number = 3;
  protected storage: TaskStorage;
  protected errorHandler: ErrorHandler;
  protected options: TaskOptions;
  protected error: Error | null = null;
  protected stopRequested: boolean = false;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: TaskOptions) {
    this.bot = bot;
    this.mineflayerBot = bot.getMineflayerBot();
    this.commandHandler = commandHandler;
    this.storage = new TaskStorage('./data');
    this.errorHandler = new ErrorHandler(bot);
    this.options = {
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 70000,
      ...options,
    };
  }

  public async execute(task: Task | null, taskId: string): Promise<TaskResult> {
    this.taskId = taskId;
    this.startTime = Date.now();
    this.retryCount = 0;

    try {
      await this.validateTask();
      await this.initializeProgress();
      await this.performTask();
      this.endTime = Date.now();
      metrics.tasksCompleted.inc({ task_type: task?.type || 'unknown' });
      return {
        success: true,
        task: task!,
        duration: this.endTime - this.startTime,
      };
    } catch (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
      this.endTime = Date.now();
      metrics.tasksFailed.inc({
        task_type: task?.type || 'unknown',
        error_type: this.error.message,
      });
      return {
        success: false,
        task: task!,
        duration: this.endTime - this.startTime,
        error: this.error.message,
      };
    }
  }

  public async validateTask(): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot instance is required');
    }
    if (!this.commandHandler) {
      throw new Error('Command handler is required');
    }
  }

  public async initializeProgress(): Promise<void> {
    this.currentProgress = 0;
    this.currentStep = 0;
    this.startTime = Date.now();
    this.progressHistory = [];
    this.errorCount = 0;
    this.retryCount = 0;
    await this.updateProgress(0);
  }

  public async performTask(): Promise<void> {
    throw new Error('performTask must be implemented by subclasses');
  }

  public async updateProgress(progress: number): Promise<void> {
    this.currentProgress = Math.min(Math.max(progress, 0), this.totalProgress);
    const now = Date.now();
    
    // Calculate estimated time remaining
    if (this.progressHistory.length > 0) {
      const timeElapsed = now - this.startTime;
      const progressPerMs = this.currentProgress / timeElapsed;
      this.estimatedTimeRemaining = progressPerMs > 0 
        ? (100 - this.currentProgress) / progressPerMs 
        : 0;
    }

    // Update location if available
    if (this.mineflayerBot.entity) {
      const pos = this.mineflayerBot.entity.position;
      this.currentLocation = {
        x: Math.floor(pos.x),
        y: Math.floor(pos.y),
        z: Math.floor(pos.z),
      };
    }

    // Record progress history
    this.progressHistory.push({
      timestamp: now,
      progress: this.currentProgress
    });

    const taskProgress: TaskProgress = {
      taskId: this.taskId!,
      currentProgress: this.currentProgress,
      totalProgress: this.totalProgress,
      status: this.status,
      estimatedTimeRemaining: Math.round(this.estimatedTimeRemaining / 1000), // Convert to seconds
      currentLocation: this.currentLocation,
      errorCount: this.errorCount,
      retryCount: this.retryCount,
      progressHistory: this.progressHistory,
      lastUpdated: now,
      created: this.startTime
    };

    // Save progress to storage
    await this.storage.saveProgress(this.taskId!, taskProgress);
    this.commandHandler.updateProgress(this.taskId!, this.currentProgress);
    this.lastProgressUpdate = now;
  }

  public shouldRetry(): boolean {
    return this.retryCount < (this.options.maxRetries || 3);
  }

  public async retry(): Promise<void> {
    if (!this.shouldRetry()) {
      throw new Error('Max retries exceeded');
    }
    this.retryCount++;
    await new Promise(resolve => setTimeout(resolve, this.options.retryDelay || 5000));
    await this.performTask();
  }

  protected async handleError(error: Error, context: Partial<ErrorContext> = {}): Promise<void> {
    logger.error('Task error', {
      taskId: this.taskId,
      error: error.message,
      ...context,
    });
    metrics.tasksFailed.inc({
      task_type: context.taskType || 'unknown',
      error_type: error.message,
    });
  }

  protected async completeTask(): Promise<void> {
    const duration = Date.now() - this.startTime;
    metrics.taskDuration.observe(
      { task_type: this.constructor.name },
      duration
    );

    logger.info('Task completed', {
      taskId: this.taskId,
      duration,
    });

    await this.updateProgress(100);
  }

  protected async incrementProgress(): Promise<void> {
    this.currentStep++;
    const progress = (this.currentStep / this.progressSteps) * 100;
    await this.updateProgress(Math.min(progress, 100));
  }

  protected setProgressSteps(steps: number): void {
    this.progressSteps = steps;
    this.totalProgress = steps;
  }

  protected checkTimeout(): void {
    const elapsed = Date.now() - this.startTime;
    if (elapsed > (this.options.timeout || 30000)) {
      throw new Error('Task timed out');
    }
  }

  protected getCurrentPosition(): Position | undefined {
    if (!this.currentLocation) {
      return undefined;
    }
    return {
      x: this.currentLocation.x,
      y: this.currentLocation.y,
      z: this.currentLocation.z,
      yaw: this.currentLocation.yaw,
      pitch: this.currentLocation.pitch
    };
  }

  public stop(): void {
    this.stopRequested = true;
  }
} 