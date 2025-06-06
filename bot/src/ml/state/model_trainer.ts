import { TrainingDataCollector } from './training_data_collector';
import { DataPreprocessor, ProcessedData } from './data_preprocessor';
import { mlMetrics } from '../../utils/observability/metrics';
import { Model, ResourceNeedModel, PlayerRequestModel, TaskDurationModel } from './models';
import { ModelStorage } from './model_storage';
import { Logger } from '@/utils/observability/logger';

const logger = new Logger();

interface ModelConfig {
  batchSize: number;
  epochs: number;
  learningRate: number;
  validationSplit: number;
  earlyStoppingPatience: number;
}

interface TrainingResult {
  modelId: string;
  metrics: {
    loss: number;
    accuracy: number;
    validationLoss: number;
    validationAccuracy: number;
  };
  trainingTime: number;
  modelSize: number;
}

export class ModelTrainer {
  private dataCollector: TrainingDataCollector;
  private preprocessor: DataPreprocessor;
  private config: ModelConfig;
  private modelVersions: Map<string, number>;
  private storage: ModelStorage;

  constructor(
    dataCollector: TrainingDataCollector,
    config: ModelConfig = {
      batchSize: 32,
      epochs: 10,
      learningRate: 0.001,
      validationSplit: 0.2,
      earlyStoppingPatience: 3
    },
    storage: ModelStorage = new ModelStorage()
  ) {
    this.dataCollector = dataCollector;
    this.preprocessor = new DataPreprocessor();
    this.config = config;
    this.modelVersions = new Map();
    this.storage = storage;
  }

  public async trainModel(predictionType: string): Promise<TrainingResult> {
    try {
      logger.info(`Starting model training for prediction type: ${predictionType}`);
      
      // Get training data
      logger.info('Fetching training data...');
      const trainingData = this.dataCollector.getTrainingData(predictionType);
      if (!trainingData) {
        throw new Error(`No training data available for ${predictionType}`);
      }
      logger.info(`Retrieved ${trainingData.predictions.length} training records`);

      // Preprocess data
      logger.info('Preprocessing training data...');
      const processedData = await this.preprocessor.preprocessData(trainingData);
      logger.info('Data preprocessing completed');

      // Split data into training and validation sets
      logger.info('Splitting data into training and validation sets...');
      const { trainData, valData } = this.splitData(processedData);
      logger.info(`Split data: ${trainData.features.length} training samples, ${valData.features.length} validation samples`);

      // Initialize model based on prediction type
      logger.info('Initializing model...');
      const model = this.initializeModel(predictionType);
      logger.info('Model initialization completed');

      // Train model
      logger.info('Starting model training...');
      const startTime = Date.now();
      const result = await this.trainModelWithData(model, trainData, valData);
      const trainingTime = Date.now() - startTime;
      logger.info(`Model training completed in ${trainingTime}ms`);

      // Update model version
      const currentVersion = this.modelVersions.get(predictionType) || 0;
      this.modelVersions.set(predictionType, currentVersion + 1);
      logger.info(`Updated model version to v${currentVersion + 1}`);

      // Store model
      logger.info('Storing trained model...');
      await this.storeModel(predictionType, model, result);
      logger.info('Model storage completed');

      return {
        modelId: `${predictionType}_v${currentVersion + 1}`,
        metrics: result,
        trainingTime,
        modelSize: this.calculateModelSize(model)
      };
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'training_error' });
      logger.error('Error during model training:', error);
      throw error;
    }
  }

  private splitData(data: ProcessedData): { trainData: ProcessedData; valData: ProcessedData } {
    logger.info('Splitting data into training and validation sets...');
    const splitIndex = Math.floor(data.features.length * (1 - this.config.validationSplit));
    logger.info(`Split point: ${splitIndex} (${Math.round((1 - this.config.validationSplit) * 100)}% training, ${Math.round(this.config.validationSplit * 100)}% validation)`);
    
    return {
      trainData: {
        features: data.features.slice(0, splitIndex),
        labels: data.labels.slice(0, splitIndex),
        metadata: data.metadata
      },
      valData: {
        features: data.features.slice(splitIndex),
        labels: data.labels.slice(splitIndex),
        metadata: data.metadata
      }
    };
  }

  private initializeModel(predictionType: string): Model {
    switch (predictionType) {
      case 'resource_needs':
        return new ResourceNeedModel(this.config.learningRate);
      case 'player_requests':
        return new PlayerRequestModel(this.config.learningRate);
      case 'task_duration':
        return new TaskDurationModel(this.config.learningRate);
      default:
        throw new Error(`Unknown prediction type: ${predictionType}`);
    }
  }

  private async trainModelWithData(
    model: Model,
    trainData: ProcessedData,
    valData: ProcessedData
  ): Promise<TrainingResult['metrics']> {
    return await model.train(trainData, valData);
  }

  private async storeModel(
    predictionType: string,
    model: Model,
    metrics: TrainingResult['metrics']
  ): Promise<void> {
    const modelId = `${predictionType}_v${this.getModelVersion(predictionType)}`;
    await model.save(this.storage, modelId, metrics);
  }

  private calculateModelSize(model: Model): number {
    return model.getSize();
  }

  public getModelVersion(predictionType: string): number {
    return this.modelVersions.get(predictionType) || 0;
  }

  public async validateModel(
    predictionType: string,
    modelId: string
  ): Promise<{ isValid: boolean; metrics: TrainingResult['metrics'] }> {
    const model = this.initializeModel(predictionType);
    
    try {
      await model.load(this.storage, modelId);
      const trainingData = this.dataCollector.getTrainingData(predictionType);
      if (!trainingData) {
        throw new Error(`No training data available for ${predictionType}`);
      }

      const processedData = await this.preprocessor.preprocessData(trainingData);
      const { trainData, valData } = this.splitData(processedData);
      
      const metrics = await model.train(trainData, valData);
      
      return {
        isValid: metrics.validationAccuracy >= 0.8,
        metrics
      };
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'validation_error' });
      throw error;
    }
  }

  public async rollbackModel(predictionType: string): Promise<boolean> {
    const currentVersion = this.modelVersions.get(predictionType);
    if (!currentVersion || currentVersion <= 1) {
      return false;
    }

    const modelId = `${predictionType}_v${currentVersion}`;
    await this.storage.deleteModel(modelId);
    this.modelVersions.set(predictionType, currentVersion - 1);
    return true;
  }

  public async listModels(predictionType?: string): Promise<string[]> {
    const models = await this.storage.listModels();
    if (!predictionType) return models;
    return models.filter(modelId => modelId.startsWith(predictionType));
  }
} 