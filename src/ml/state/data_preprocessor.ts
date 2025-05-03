import { PredictionRecord, TrainingData } from './training_data_collector';
import { mlMetrics } from '../../utils/observability/metrics';
import logger from '../../utils/observability/logger';

export interface ProcessedData {
  features: number[];
  labels: number[];
  metadata: {
    min: number[];
    max: number[];
    mean: number[];
    std: number[];
  };
}

export class DataPreprocessor {
  private featureScaling: Map<string, { min: number; max: number }>;
  private normalizationParams: Map<string, { mean: number; std: number }>;

  constructor() {
    this.featureScaling = new Map();
    this.normalizationParams = new Map();
  }

  public async preprocessData(data: TrainingData): Promise<ProcessedData> {
    try {
      logger.info('Starting data preprocessing...');
      
      // Clean the data
      logger.info('Cleaning data...');
      const cleanedData = this.cleanData(data.predictions);
      logger.info(`Cleaned data: ${cleanedData.length} records remaining`);
      
      // Extract features
      logger.info('Extracting features...');
      const features = this.extractFeatures(cleanedData);
      logger.info(`Extracted ${features.length} feature vectors`);
      
      // Normalize features
      logger.info('Normalizing features...');
      const normalizedFeatures = this.normalizeFeatures(features);
      logger.info('Feature normalization completed');
      
      // Extract labels
      logger.info('Extracting labels...');
      const labels = this.extractLabels(cleanedData);
      logger.info(`Extracted ${labels.length} labels`);
      
      logger.info('Data preprocessing completed successfully');
      return {
        features: normalizedFeatures,
        labels,
        metadata: {
          min: Array.from(this.featureScaling.values()).map(p => p.min),
          max: Array.from(this.featureScaling.values()).map(p => p.max),
          mean: Array.from(this.normalizationParams.values()).map(p => p.mean),
          std: Array.from(this.normalizationParams.values()).map(p => p.std)
        }
      };
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'preprocessing_error' });
      logger.error('Error during data preprocessing:', error);
      throw error;
    }
  }

  private cleanData(records: PredictionRecord[]): PredictionRecord[] {
    logger.info(`Starting data cleaning with ${records.length} records`);
    const cleanedRecords = records.filter(record => {
      // Remove records with missing or invalid data
      if (!record.input || !record.output) return false;
      
      // Remove records with invalid timestamps
      if (record.timestamp <= 0) return false;
      
      // Remove records with invalid confidence values
      if (record.confidence < 0 || record.confidence > 1) return false;
      
      // Remove records with invalid execution times
      if (record.executionTime < 0) return false;
      
      return true;
    });
    logger.info(`Data cleaning completed. Removed ${records.length - cleanedRecords.length} invalid records`);
    return cleanedRecords;
  }

  private extractFeatures(records: PredictionRecord[]): number[][] {
    logger.info(`Starting feature extraction for ${records.length} records`);
    const features = records.map((record, index) => {
      if (index % 1000 === 0) {
        logger.info(`Processing record ${index + 1}/${records.length}`);
      }
      
      const featureVector: number[] = [];
      
      // Extract timestamp features
      const date = new Date(record.timestamp);
      featureVector.push(
        date.getHours(), // Hour of day
        date.getDay(),   // Day of week
        date.getMonth()  // Month
      );
      
      // Extract confidence and execution time
      featureVector.push(record.confidence, record.executionTime);
      
      // Extract input features based on prediction type
      switch (record.predictionType) {
        case 'resource_needs':
          featureVector.push(...this.extractResourceFeatures(record.input));
          break;
        case 'player_requests':
          featureVector.push(...this.extractPlayerFeatures(record.input));
          break;
        case 'task_duration':
          featureVector.push(...this.extractTaskFeatures(record.input));
          break;
      }
      
      return featureVector;
    });
    logger.info(`Feature extraction completed. Generated ${features.length} feature vectors`);
    return features;
  }

  private extractResourceFeatures(input: any): number[] {
    const features: number[] = [];
    
    // Extract inventory-related features
    if (input.gameState?.bot?.inventory) {
      const inventory = input.gameState.bot.inventory;
      features.push(
        inventory.items().length, // Number of items
        inventory.emptySlots(),   // Number of empty slots
        inventory.slots.length    // Total slots
      );
    }
    
    // Extract dependency-related features
    if (input.dependencies) {
      features.push(
        input.dependencies.length, // Number of dependencies
        input.dependencies.reduce((sum: number, dep: any) => 
          sum + (dep.dependencies?.length || 0), 0) // Total sub-dependencies
      );
    }
    
    return features;
  }

  private extractPlayerFeatures(input: any): number[] {
    const features: number[] = [];
    
    // Extract player-related features
    if (input.gameState?.bot?.players) {
      const players = input.gameState.bot.players;
      features.push(
        Object.keys(players).length, // Number of players
        players.filter((p: any) => p.username === input.gameState.bot.username).length // Is player the bot
      );
    }
    
    return features;
  }

  private extractTaskFeatures(input: any): number[] {
    const features: number[] = [];
    
    // Extract task-related features
    if (input.gameState?.bot?.tasks) {
      const tasks = input.gameState.bot.tasks;
      features.push(
        tasks.length, // Number of tasks
        tasks.filter((t: any) => t.status === 'running').length, // Running tasks
        tasks.filter((t: any) => t.status === 'completed').length // Completed tasks
      );
    }
    
    return features;
  }

  private normalizeFeatures(features: number[][]): number[] {
    logger.info('Starting feature normalization...');
    // Flatten the 2D array
    const flatFeatures = features.flat();
    logger.info(`Flattened ${features.length} feature vectors into ${flatFeatures.length} values`);
    
    // Calculate min and max for feature scaling
    const min = Math.min(...flatFeatures);
    const max = Math.max(...flatFeatures);
    this.featureScaling.set('features', { min, max });
    logger.info(`Calculated feature scaling: min=${min}, max=${max}`);
    
    // Calculate mean and standard deviation for normalization
    const mean = flatFeatures.reduce((a, b) => a + b, 0) / flatFeatures.length;
    const std = Math.sqrt(
      flatFeatures.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / flatFeatures.length
    );
    this.normalizationParams.set('features', { mean, std });
    logger.info(`Calculated normalization params: mean=${mean}, std=${std}`);
    
    // Apply min-max scaling and standardization
    const normalized = flatFeatures.map(x => {
      // Min-max scaling
      const scaled = (x - min) / (max - min);
      // Standardization
      return (scaled - mean) / std;
    });
    logger.info('Feature normalization completed');
    return normalized;
  }

  private extractLabels(records: PredictionRecord[]): number[] {
    return records.map(record => record.success ? 1 : 0);
  }

  public getFeatureMetadata(): ProcessedData['metadata'] {
    return {
      min: Array.from(this.featureScaling.values()).map(p => p.min),
      max: Array.from(this.featureScaling.values()).map(p => p.max),
      mean: Array.from(this.normalizationParams.values()).map(p => p.mean),
      std: Array.from(this.normalizationParams.values()).map(p => p.std)
    };
  }
} 