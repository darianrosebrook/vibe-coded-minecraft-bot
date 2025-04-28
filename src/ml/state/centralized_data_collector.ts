import { mlMetrics } from '../../utils/observability/metrics';
import { Bot } from 'mineflayer';
import { DataPreprocessor, ProcessedData } from './data_preprocessor';
import { z } from 'zod';

// Schema definitions for data validation
const PredictionRecordSchema = z.object({
  timestamp: z.number(),
  predictionType: z.string(),
  input: z.any(),
  output: z.any(),
  success: z.boolean(),
  confidence: z.number().min(0).max(1),
  executionTime: z.number().min(0),
  metadata: z.record(z.any()).optional()
});

const TrainingDataSchema = z.object({
  predictions: z.array(PredictionRecordSchema),
  metrics: z.object({
    accuracy: z.number().min(0).max(1),
    precision: z.number().min(0).max(1),
    recall: z.number().min(0).max(1),
    f1Score: z.number().min(0).max(1)
  }),
  processedData: z.any().optional()
});

export interface PredictionRecord {
  timestamp: number;
  predictionType: string;
  input: any;
  output: any;
  success: boolean;
  confidence: number;
  executionTime: number;
  metadata?: Record<string, any>;
}

export interface TrainingData {
  predictions: PredictionRecord[];
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  processedData?: ProcessedData;
}

export class CentralizedDataCollector {
  private bot: Bot;
  private predictionHistory: Map<string, PredictionRecord[]>;
  private currentBatch: Map<string, PredictionRecord[]>;
  private batchSize: number;
  private batchInterval: number;
  private batchTimer: NodeJS.Timeout | null;
  private preprocessor: DataPreprocessor;
  private validationErrors: Map<string, Error[]>;

  constructor(
    bot: Bot,
    batchSize: number = 100,
    batchInterval: number = 3600000
  ) {
    this.bot = bot;
    this.predictionHistory = new Map();
    this.currentBatch = new Map();
    this.batchSize = batchSize;
    this.batchInterval = batchInterval;
    this.batchTimer = null;
    this.preprocessor = new DataPreprocessor();
    this.validationErrors = new Map();
  }

  public start() {
    this.batchTimer = setInterval(() => this.processBatch(), this.batchInterval);
  }

  public stop() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.processBatch(); // Process any remaining data
  }

  public async recordPrediction(
    predictionType: string,
    input: any,
    output: any,
    success: boolean,
    confidence: number,
    executionTime: number,
    metadata?: Record<string, any>
  ) {
    const record: PredictionRecord = {
      timestamp: Date.now(),
      predictionType,
      input,
      output,
      success,
      confidence,
      executionTime,
      metadata
    };

    // Validate record
    try {
      PredictionRecordSchema.parse(record);
    } catch (error) {
      this.logValidationError(predictionType, error);
      return;
    }

    // Add to current batch
    if (!this.currentBatch.has(predictionType)) {
      this.currentBatch.set(predictionType, []);
    }
    this.currentBatch.get(predictionType)!.push(record);

    // Update metrics
    mlMetrics.stateUpdates.inc({ type: 'prediction_recorded' });
    mlMetrics.predictionLatency.observe({ type: predictionType }, executionTime);

    // Process batch if size limit reached
    if (this.currentBatch.get(predictionType)!.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  private logValidationError(predictionType: string, error: any) {
    if (!this.validationErrors.has(predictionType)) {
      this.validationErrors.set(predictionType, []);
    }
    this.validationErrors.get(predictionType)!.push(error);
    mlMetrics.stateUpdates.inc({ type: 'validation_error' });
  }

  private async processBatch() {
    for (const [type, records] of this.currentBatch) {
      try {
        // Validate batch
        TrainingDataSchema.parse({
          predictions: records,
          metrics: this.calculateMetrics(records)
        });

        if (!this.predictionHistory.has(type)) {
          this.predictionHistory.set(type, []);
        }
        this.predictionHistory.get(type)!.push(...records);
        
        // Calculate metrics
        const metrics = this.calculateMetrics(records);
        
        // Preprocess data
        const processedData = await this.preprocessor.preprocessData({
          predictions: records,
          metrics
        });
        
        // Store metrics and processed data
        await this.storeMetrics(type, metrics, processedData);
        
        // Clear current batch
        this.currentBatch.set(type, []);
      } catch (error) {
        this.logValidationError(type, error);
      }
    }
  }

  private calculateMetrics(records: PredictionRecord[]): TrainingData['metrics'] {
    if (records.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      };
    }

    const truePositives = records.filter(r => r.success && r.confidence >= 0.5).length;
    const falsePositives = records.filter(r => !r.success && r.confidence >= 0.5).length;
    const trueNegatives = records.filter(r => !r.success && r.confidence < 0.5).length;
    const falseNegatives = records.filter(r => r.success && r.confidence < 0.5).length;

    const accuracy = (truePositives + trueNegatives) / records.length;
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score
    };
  }

  private async storeMetrics(
    predictionType: string,
    metrics: TrainingData['metrics'],
    processedData: ProcessedData
  ) {
    const data: TrainingData = {
      predictions: this.predictionHistory.get(predictionType) || [],
      metrics,
      processedData
    };

    // TODO: Implement actual storage mechanism
    // For now, we'll just log the metrics and processed data
    console.log(`Metrics for ${predictionType}:`, metrics);
    console.log(`Processed data for ${predictionType}:`, processedData);
  }

  public getTrainingData(predictionType: string): TrainingData | null {
    const predictions = this.predictionHistory.get(predictionType);
    if (!predictions) return null;

    const metrics = this.calculateMetrics(predictions);
    return {
      predictions,
      metrics
    };
  }

  public getValidationErrors(predictionType?: string): Map<string, Error[]> {
    if (predictionType) {
      return new Map([[predictionType, this.validationErrors.get(predictionType) || []]]);
    }
    return this.validationErrors;
  }

  public clearData(predictionType?: string) {
    if (predictionType) {
      this.predictionHistory.delete(predictionType);
      this.currentBatch.delete(predictionType);
      this.validationErrors.delete(predictionType);
    } else {
      this.predictionHistory.clear();
      this.currentBatch.clear();
      this.validationErrors.clear();
    }
  }
} 