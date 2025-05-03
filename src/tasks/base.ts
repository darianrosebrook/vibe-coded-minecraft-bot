import { Bot as MineflayerBot } from 'mineflayer';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { CommandHandler } from '../commands';
import { TaskStorage, StorageConfig, TaskResult } from '../storage/taskStorage';
import { ErrorHandler, ErrorContext } from '../error/errorHandler';
import { MinecraftBot } from '../bot/bot';
import { MLStateManager } from '../ml/state/manager';
import { WorldTracker } from '../bot/worldTracking';
import { CentralizedDataCollector } from '../ml/state/centralized_data_collector';
import { TrainingDataStorage } from '../ml/state/training_data_storage';
import { Vec3 } from 'vec3';
import { goals } from 'mineflayer-pathfinder';
import { Task, TaskStatus, TaskType } from '@/types/task';
import { TaskProgress } from '@/types/task';
import { BaseTaskInterface, TaskParameters } from '@/types/task';
import { Position } from '@/types/core';
import { PerformanceTracker } from '@/utils/observability/performance';
import { IDataCollector } from '@/types/ml/interfaces';

export interface BaseTaskOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  useML?: boolean;
  avoidWater?: boolean;
  usePathfinding?: boolean;
}

export type TaskOptions = TaskParameters & BaseTaskOptions;

export abstract class BaseTask implements BaseTaskInterface {
  protected mineflayerBot: MineflayerBot;
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

  // ML and State Management
  protected stateManager: MLStateManager;
  protected worldTracker: WorldTracker;
  protected dataCollector: IDataCollector;
  protected trainingStorage: TrainingDataStorage;
  protected useML: boolean = false;
  protected radius: number = 10;
  protected isStopped: boolean = false;
  protected progress: number = 0;

  // Performance Tracking
  protected performanceTracker: PerformanceTracker;

  constructor(
    protected bot: MinecraftBot,
    protected commandHandler: CommandHandler,
    options: TaskOptions
  ) {
    this.mineflayerBot = bot.getMineflayerBot();
    this.storage = new TaskStorage('./data');
    this.errorHandler = new ErrorHandler(bot);
    this.options = {
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 70000,
      useML: false,
      avoidWater: false,
      ...options,
    };

    // Initialize ML and state management
    this.stateManager = new MLStateManager(bot);
    this.worldTracker = new WorldTracker(bot);
    this.dataCollector = bot.getMLManager().getDataCollector();
    this.trainingStorage = new TrainingDataStorage();
    this.useML = this.options.useML || false;

    // Initialize performance tracker
    this.performanceTracker = new PerformanceTracker();
  }

  public async initialize(): Promise<void> {
    this.performanceTracker.startTracking(`${this.constructor.name}_initialization`);
    
    // Initialize storage
    this.storage = new TaskStorage('task_data');
    this.trainingStorage = new TrainingDataStorage();
    
    // Initialize world tracker
    this.worldTracker = new WorldTracker(this.bot);
    
    this.performanceTracker.endTracking(`${this.constructor.name}_initialization`);
  }

  public async execute(task: Task | null, taskId: string): Promise<TaskResult> {
    this.taskId = taskId;
    this.startTime = Date.now();
    this.retryCount = 0;

    // Set active task in the MinecraftBot for ML tracking
    const taskType = task?.type || 'unknown';
    const taskInfo = {
      ...task?.parameters,
      taskId: taskId
    };
    this.bot.setActiveTask(taskType, taskInfo);

    try {
      await this.validateTask();
      await this.initializeProgress();
      await this.performTask();
      this.endTime = Date.now();
      metrics.tasksCompleted.inc({ task_type: task?.type || 'unknown' });
      
      // Clear active task when complete
      this.bot.clearActiveTask();
      
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
      
      // Clear active task on failure
      this.bot.clearActiveTask();
      
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

    // Update task progress in the MinecraftBot for ML tracking
    this.bot.updateTaskProgress(this.currentProgress);

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
      current: this.currentProgress,
      total: this.totalProgress,
      status: this.status,
      estimatedTimeRemaining: Math.round(this.estimatedTimeRemaining / 1000), // Convert to seconds
      currentLocation: this.currentLocation,
      errorCount: this.errorCount,
      retryCount: this.retryCount,
      progressHistory: this.progressHistory,
      lastUpdated: now,
      created: this.startTime,
      currentProgress: this.currentProgress,
      totalProgress: this.totalProgress,
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
    };
  }

  public stop(): void {
    this.stopRequested = true;
    this.mineflayerBot.pathfinder?.stop();
    
    // Clear active task when stopped
    this.bot.clearActiveTask();
    
    logger.info('Task stopped', { taskId: this.taskId });
  }

  protected async navigateTo(position: Vec3): Promise<void> {
    if (!this.mineflayerBot.pathfinder) {
      throw new Error('Pathfinder not initialized');
    }

    if (this.options.usePathfinding) {
      const goal = new goals.GoalBlock(position.x, position.y, position.z);
      const movements = this.mineflayerBot.pathfinder.movements;

      if (this.options.avoidWater) {
        movements.allowSprinting = true;
        movements.allowParkour = true;
      }

      await this.mineflayerBot.pathfinder.goto(goal);
    } else {
      await this.mineflayerBot.lookAt(position);
      await this.mineflayerBot.setControlState('forward', true);

      while (this.mineflayerBot.entity.position.distanceTo(position) > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await this.mineflayerBot.setControlState('forward', false);
    }
  }

  protected async ensureTool(toolType: string, target: string): Promise<void> {
    const toolManager = this.bot.getToolManager();
    await toolManager.ensureTool(toolType, target);
  }

  protected abstract getTaskSpecificState(): Promise<any>;

  protected async updateMLState(): Promise<void> {
    if (!this.useML) return;

    const baseState = {
      position: this.mineflayerBot.entity.position,
      inventory: this.mineflayerBot.inventory.items(),
      biome: this.mineflayerBot.world.getBiome(this.mineflayerBot.entity.position)
    };

    const taskState = await this.getTaskSpecificState();
    const state = { ...baseState, ...taskState };

    await this.collectTrainingData({
      type: this.constructor.name.toLowerCase(),
      state,
      metadata: {
        biome: baseState.biome,
        position: baseState.position
      }
    });
  }

  protected async initializeMLState(): Promise<void> {
    if (!this.useML) return;

    try {
      await this.stateManager.updateStateAsync();
      await this.dataCollector.recordPrediction(
        'task_initialization',
        { taskType: this.constructor.name },
        { success: true },
        true,
        1.0,
        0
      );
    } catch (error) {
      logger.error('Failed to initialize ML state', { error });
      this.useML = false;
    }
  }

  protected calculateEfficiency(metric: string, value: number, maxValue: number): number {
    return Math.min(Math.max(value / maxValue, 0), 1);
  }

  protected async collectTrainingData(data: any): Promise<void> {
    if (!this.useML) return;

    try {
      await this.dataCollector.recordPrediction(
        'training_data',
        data,
        { success: true },
        true,
        1.0,
        0
      );
    } catch (error) {
      logger.error('Failed to collect training data', { error });
    }
  }

  protected getDataCollector(): IDataCollector {
    return this.dataCollector;
  }

  protected getStorage(): TaskStorage {
    return this.storage;
  }

  protected getTrainingStorage(): TrainingDataStorage {
    return this.trainingStorage;
  }

  protected getWorldTracker(): WorldTracker {
    return this.worldTracker;
  }
} 