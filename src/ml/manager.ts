import { MLConfig, MLConfigSchema, DEFAULT_ML_CONFIG } from './config';
import { MLStateManager } from './state/manager';
import { MLFeedbackSystem } from './reinforcement/feedback';
import { MLModelTrainer } from './training/MLModelTrainer';
import { CentralizedDataCollector } from './state/centralized_data_collector';
import { TrainingDataStorage } from './state/training_data_storage';
import { MinecraftBot } from '../bot/bot';
import logger from '../utils/observability/logger';
import {
  IMLStateManager,
  IMLFeedbackSystem,
  IMLModelTrainer,
  IDataCollector,
  ITrainingDataStorage,
  IMLComponent
} from '@/types/ml/interfaces'; 
import { MLDataManager } from './storage/MLDataManager'; 
import { ModelConfig } from '@/types/ml/training';
import { Bot } from 'mineflayer';
import { PerformanceTracker } from '../utils/observability/performance';

export class MLManager implements IMLComponent {
  private stateManager!: IMLStateManager;
  private feedbackSystem!: IMLFeedbackSystem;
  private modelTrainer!: IMLModelTrainer;
  private dataCollector!: CentralizedDataCollector;
  private trainingStorage!: ITrainingDataStorage;
  private config: MLConfig;
  private isInitialized: boolean = false;
  private isShuttingDown: boolean = false;
  private backgroundTasks: Promise<void>[] = [];
  private dataManager: MLDataManager;
  private performanceTracker: PerformanceTracker;

  constructor(
    private bot: MinecraftBot,
    config: Partial<MLConfig> = {},
    performanceTracker: PerformanceTracker
  ) {
    this.config = MLConfigSchema.parse({ ...DEFAULT_ML_CONFIG, ...config });
    this.dataManager = new MLDataManager(this.config.dataCollection.dataPath);
    this.performanceTracker = performanceTracker;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('MLManager already initialized');
      return;
    }

    try {
      // Initialize components in the correct order
      this.performanceTracker.startTracking('ml_state_manager_initialization');
      this.stateManager = new MLStateManager(this.bot) as unknown as IMLStateManager;
      this.performanceTracker.endTracking('ml_state_manager_initialization');

      this.performanceTracker.startTracking('ml_feedback_system_initialization');
      this.feedbackSystem = new MLFeedbackSystem(this.bot as unknown as Bot) as unknown as IMLFeedbackSystem;
      this.performanceTracker.endTracking('ml_feedback_system_initialization');

      this.performanceTracker.startTracking('ml_model_trainer_initialization');
      this.modelTrainer = new MLModelTrainer(this.dataManager, this.config as unknown as ModelConfig) as unknown as IMLModelTrainer;
      this.performanceTracker.endTracking('ml_model_trainer_initialization');

      this.performanceTracker.startTracking('ml_data_collector_initialization');
      this.dataCollector = new CentralizedDataCollector(
        this.bot.getMineflayerBot(),
        this.config.training.batchSize,
        this.config.dataCollection.cleanupInterval
      );
      await this.dataCollector.initialize();
      this.dataCollector.start();
      this.performanceTracker.endTracking('ml_data_collector_initialization');

      this.trainingStorage = new TrainingDataStorage() as unknown as ITrainingDataStorage;

      this.isInitialized = true;
      logger.info('MLManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MLManager', { error });
      throw error;
    }
  }

  private startBackgroundTasks(): void {
    const tasks = [
      this.cleanupOldData(),
      this.collectFeedback(),
      this.optimizeModels()
    ];

    this.backgroundTasks = tasks.map(task => 
      task.catch(error => {
        logger.error('Background task failed', { error });
      })
    );
  }

  private async cleanupOldData(): Promise<void> {
    try {
      const cutoffTime = Date.now() - this.config.dataCollection.dataRetentionPeriod;
      await this.trainingStorage.cleanup(this.config.dataCollection.maxStorageSize);
      await this.dataManager.cleanup(this.config.dataCollection.maxDataSize);
    } catch (error) {
      logger.error('Failed to cleanup old data', { error });
    }
  }

  private async collectFeedback(): Promise<void> {
    try {
      const feedback = await this.feedbackSystem.collectFeedback();
      if (feedback !== undefined) {
        await this.trainingStorage.storeTrainingData('feedback', feedback, Date.now());
      }
    } catch (error) {
      logger.error('Failed to collect feedback', { error });
    }
  }

  private async optimizeModels(): Promise<void> {
    try {
      const trainingData = await this.dataManager.getTrainingData('training');
      if (trainingData) {
        await this.modelTrainer.trainModel(trainingData);
      }
    } catch (error) {
      logger.error('Failed to optimize models', { error });
    }
  }

  private async cleanup(): Promise<void> {
    const errors: Error[] = [];

    // Stop any ongoing background tasks first
    this.isShuttingDown = true;
      
    // Shutdown components in reverse order of initialization
    const components = [
      { name: 'dataCollector', instance: this.dataCollector },
      { name: 'trainingStorage', instance: this.trainingStorage },
      { name: 'dataManager', instance: this.dataManager },
      { name: 'modelTrainer', instance: this.modelTrainer },
      { name: 'feedbackSystem', instance: this.feedbackSystem },
      { name: 'stateManager', instance: this.stateManager }
    ];

    for (const { name, instance } of components) {
      if (!instance) continue;
      
      try {
        await instance.shutdown();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to shutdown ${name}`, { error: errorMessage });
        errors.push(new Error(`${name} shutdown failed: ${errorMessage}`));
      }
    }
      
    // Clear any remaining background tasks
    this.backgroundTasks = [];

    // If any component failed to shutdown, throw an aggregated error
    if (errors.length > 0) {
      const errorMessages = errors.map(e => e.message).join('; ');
      throw new Error(`MLManager cleanup failed: ${errorMessages}`);
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized || this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    try {
      await this.cleanup();
      this.isInitialized = false;
      this.isShuttingDown = false;
      logger.info('MLManager shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown MLManager', { error });
      this.isShuttingDown = false;
      throw error;
    }
  }

  // Getters
  public getStateManager(): IMLStateManager {
    return this.stateManager;
  }

  public getFeedbackSystem(): IMLFeedbackSystem {
    return this.feedbackSystem;
  }

  public getModelTrainer(): IMLModelTrainer {
    return this.modelTrainer;
  }

  public getDataCollector(): CentralizedDataCollector {
    return this.dataCollector;
  }

  public getTrainingStorage(): ITrainingDataStorage {
    return this.trainingStorage;
  }

  public getConfig(): MLConfig {
    return { ...this.config };
  }
} 