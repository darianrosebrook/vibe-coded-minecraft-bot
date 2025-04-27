import { PredictionRecord, TrainingData } from './training_data_collector';
import { mlMetrics } from '../../utils/observability/metrics';

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
      // Clean the data
      const cleanedData = this.cleanData(data.predictions);
      
      // Extract features
      const features = this.extractFeatures(cleanedData);
      
      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(features);
      
      // Extract labels
      const labels = this.extractLabels(cleanedData);
      
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
      throw error;
    }
  }

  private cleanData(records: PredictionRecord[]): PredictionRecord[] {
    return records.filter(record => {
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
  }

  private extractFeatures(records: PredictionRecord[]): number[][] {
    return records.map(record => {
      const features: number[] = [];
      
      // Extract timestamp features
      const date = new Date(record.timestamp);
      features.push(
        date.getHours(), // Hour of day
        date.getDay(),   // Day of week
        date.getMonth()  // Month
      );
      
      // Extract confidence and execution time
      features.push(record.confidence, record.executionTime);
      
      // Extract input features based on prediction type
      switch (record.predictionType) {
        case 'resource_needs':
          features.push(...this.extractResourceFeatures(record.input));
          break;
        case 'player_requests':
          features.push(...this.extractPlayerFeatures(record.input));
          break;
        case 'task_duration':
          features.push(...this.extractTaskFeatures(record.input));
          break;
      }
      
      return features;
    });
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
    // Flatten the 2D array
    const flatFeatures = features.flat();
    
    // Calculate min and max for feature scaling
    const min = Math.min(...flatFeatures);
    const max = Math.max(...flatFeatures);
    this.featureScaling.set('features', { min, max });
    
    // Calculate mean and standard deviation for normalization
    const mean = flatFeatures.reduce((a, b) => a + b, 0) / flatFeatures.length;
    const std = Math.sqrt(
      flatFeatures.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / flatFeatures.length
    );
    this.normalizationParams.set('features', { mean, std });
    
    // Apply min-max scaling and standardization
    return flatFeatures.map(x => {
      // Min-max scaling
      const scaled = (x - min) / (max - min);
      // Standardization
      return (scaled - mean) / std;
    });
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