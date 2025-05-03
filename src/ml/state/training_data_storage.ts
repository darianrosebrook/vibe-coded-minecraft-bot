import { TrainingData, PredictionRecord } from './centralized_data_collector';
import { mlMetrics } from '../../utils/observability/metrics';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { gzip, ungzip } from 'node-gzip';
import { Buffer } from 'buffer';
import logger from '@/utils/observability/logger';
import { ITrainingDataStorage } from '@/types/ml/interfaces';

const StorageConfigSchema = z.object({
  basePath: z.string(),
  maxVersions: z.number().min(1).default(5),
  compression: z.boolean().default(true),
  format: z.enum(['json', 'binary']).default('json')
});

export type StorageConfig = z.infer<typeof StorageConfigSchema>;

export class TrainingDataStorage implements ITrainingDataStorage {
  private config: StorageConfig;
  private versionHistory: Map<string, number[]>;
  private isInitialized: boolean = false;
  private data: Map<string, any> = new Map();

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = StorageConfigSchema.parse({
      basePath: './data/training',
      maxVersions: 5,
      compression: true,
      format: 'json',
      ...config
    });
    this.versionHistory = new Map();
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.basePath, { recursive: true });
      await this.loadVersionHistory();
      this.isInitialized = true;
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'storage_init_error' });
      throw error;
    }
  }

  private async loadVersionHistory(): Promise<void> {
    const historyPath = path.join(this.config.basePath, 'version_history.json');
    try {
      const data = await fs.readFile(historyPath, 'utf-8');
      this.versionHistory = new Map(JSON.parse(data));
    } catch (error) {
      // If file doesn't exist, start with empty history
      this.versionHistory = new Map();
    }
  }

  private async saveVersionHistory(): Promise<void> {
    const historyPath = path.join(this.config.basePath, 'version_history.json');
    await fs.writeFile(
      historyPath,
      JSON.stringify(Array.from(this.versionHistory.entries()))
    );
  }

  public async storeTrainingData(
    predictionType: string,
    data: TrainingData,
    version: number
  ): Promise<void> {
    try {
      // Validate data
      const validatedData = this.validateData(data);

      // Update version history
      if (!this.versionHistory.has(predictionType)) {
        this.versionHistory.set(predictionType, []);
      }
      const versions = this.versionHistory.get(predictionType)!;
      versions.push(version);
      versions.sort((a, b) => b - a); // Sort in descending order

      // Trim old versions if needed
      if (versions.length > this.config.maxVersions) {
        const oldVersions = versions.splice(this.config.maxVersions);
        await this.deleteVersions(predictionType, oldVersions);
      }

      // Save data
      const filePath = this.getFilePath(predictionType, version);
      const dataToStore = this.config.compression
        ? await this.compressData(validatedData)
        : await this.serializeBinary(validatedData);

      await fs.writeFile(
        filePath,
        this.config.format === 'json'
          ? JSON.stringify(dataToStore)
          : dataToStore
      );

      // Update version history
      await this.saveVersionHistory();

      mlMetrics.stateUpdates.inc({ type: 'data_stored' });
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'storage_error' });
      throw error;
    }
  }

  public async loadTrainingData(
    predictionType: string,
    version?: number
  ): Promise<TrainingData | null> {
    try {
      const versions = this.versionHistory.get(predictionType);
      if (!versions || versions.length === 0) {
        return null;
      }

      const targetVersion = version ?? versions[0]; // Use latest if no version specified
      if (!targetVersion) {
        return null;
      }
      const filePath = this.getFilePath(predictionType, targetVersion);

      const data = await fs.readFile(filePath, 'utf-8');
      const parsedData = this.config.format === 'json'
        ? JSON.parse(data)
        : await this.deserializeBinary(Buffer.from(data, 'base64'));

      return this.config.compression
        ? await this.decompressData(parsedData)
        : parsedData;
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'load_error' });
      return null;
    }
  }

  private getFilePath(predictionType: string, version: number): string {
    const filename = `${predictionType}_v${version}.${this.config.format}`;
    return path.join(this.config.basePath, filename);
  }

  private validateData(data: TrainingData): TrainingData {
    // Additional validation beyond schema validation
    if (data.predictions.length === 0) {
      throw new Error('Training data must contain at least one prediction');
    }

    // Validate metrics are within expected ranges
    const { metrics } = data;
    if (metrics.accuracy < 0 || metrics.accuracy > 1) {
      throw new Error('Invalid accuracy value');
    }
    if (metrics.precision < 0 || metrics.precision > 1) {
      throw new Error('Invalid precision value');
    }
    if (metrics.recall < 0 || metrics.recall > 1) {
      throw new Error('Invalid recall value');
    }
    if (metrics.f1Score < 0 || metrics.f1Score > 1) {
      throw new Error('Invalid F1 score value');
    }

    return data;
  }

  private async deleteVersions(
    predictionType: string,
    versions: number[]
  ): Promise<void> {
    for (const version of versions) {
      const filePath = this.getFilePath(predictionType, version);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        mlMetrics.stateUpdates.inc({ type: 'delete_error' });
      }
    }
  }

  private async compressData(data: TrainingData): Promise<Buffer> {
    try {
      // Convert data to a more compact format
      const compactData = {
        p: data.predictions.map(p => ({
          t: p.timestamp,
          pt: p.predictionType,
          i: p.input,
          o: p.output,
          s: p.success,
          c: p.confidence,
          et: p.executionTime,
          m: p.metadata
        })),
        m: {
          a: data.metrics.accuracy,
          p: data.metrics.precision,
          r: data.metrics.recall,
          f: data.metrics.f1Score
        },
        pd: data.processedData
      };

      // Convert to JSON and compress
      const jsonData = JSON.stringify(compactData);
      const compressed = await gzip(jsonData);
      
      mlMetrics.stateUpdates.inc({ type: 'data_compressed' });
      return compressed;
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'compression_error' });
      throw error;
    }
  }

  private async decompressData(buffer: Buffer): Promise<TrainingData> {
    try {
      // Decompress data
      const decompressed = await ungzip(buffer);
      const jsonData = decompressed.toString();
      const compactData = JSON.parse(jsonData);

      // Convert back to full format
      const data: TrainingData = {
        predictions: compactData.p.map((p: any) => ({
          timestamp: p.t,
          predictionType: p.pt,
          input: p.i,
          output: p.o,
          success: p.s,
          confidence: p.c,
          executionTime: p.et,
          metadata: p.m
        })),
        metrics: {
          accuracy: compactData.m.a,
          precision: compactData.m.p,
          recall: compactData.m.r,
          f1Score: compactData.m.f
        },
        processedData: compactData.pd
      };

      mlMetrics.stateUpdates.inc({ type: 'data_decompressed' });
      return data;
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'decompression_error' });
      throw error;
    }
  }

  private serializeBinary(data: TrainingData): Buffer {
    try {
      // Create a binary format for the data
      const binaryData = {
        version: 1,
        timestamp: Date.now(),
        predictions: data.predictions.map(p => ({
          timestamp: p.timestamp,
          predictionType: p.predictionType,
          input: this.serializeValue(p.input),
          output: this.serializeValue(p.output),
          success: p.success ? 1 : 0,
          confidence: Math.round(p.confidence * 255), // Scale to 1 byte
          executionTime: Math.round(p.executionTime),
          metadata: p.metadata ? this.serializeValue(p.metadata) : null
        })),
        metrics: {
          accuracy: Math.round(data.metrics.accuracy * 255),
          precision: Math.round(data.metrics.precision * 255),
          recall: Math.round(data.metrics.recall * 255),
          f1Score: Math.round(data.metrics.f1Score * 255)
        },
        processedData: data.processedData ? this.serializeValue(data.processedData) : null
      };

      // Convert to binary buffer
      const buffer = Buffer.from(JSON.stringify(binaryData));
      
      mlMetrics.stateUpdates.inc({ type: 'data_serialized' });
      return buffer;
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'serialization_error' });
      throw error;
    }
  }

  private deserializeBinary(buffer: Buffer): TrainingData {
    try {
      // Parse binary data
      const binaryData = JSON.parse(buffer.toString());
      
      // Convert back to full format
      const data: TrainingData = {
        predictions: binaryData.predictions.map((p: any) => ({
          timestamp: p.timestamp,
          predictionType: p.predictionType,
          input: this.deserializeValue(p.input),
          output: this.deserializeValue(p.output),
          success: p.success === 1,
          confidence: p.confidence / 255, // Scale back from 1 byte
          executionTime: p.executionTime,
          metadata: p.metadata ? this.deserializeValue(p.metadata) : undefined
        })),
        metrics: {
          accuracy: binaryData.metrics.accuracy / 255,
          precision: binaryData.metrics.precision / 255,
          recall: binaryData.metrics.recall / 255,
          f1Score: binaryData.metrics.f1Score / 255
        },
        processedData: binaryData.processedData ? this.deserializeValue(binaryData.processedData) : undefined
      };

      mlMetrics.stateUpdates.inc({ type: 'data_deserialized' });
      return data;
    } catch (error) {
      mlMetrics.stateUpdates.inc({ type: 'deserialization_error' });
      throw error;
    }
  }

  private serializeValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.map(v => this.serializeValue(v));
    }
    
    if (typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.serializeValue(val);
      }
      return result;
    }
    
    return value;
  }

  private deserializeValue(value: any): any {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.map(v => this.deserializeValue(v));
    }
    
    if (typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.deserializeValue(val);
      }
      return result;
    }
    
    return value;
  }

  public async shutdown(): Promise<void> {
    try {
      // Clear any stored data
      this.data.clear();
      this.isInitialized = false;
      logger.info('TrainingDataStorage shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown TrainingDataStorage', { error });
      throw error;
    }
  }

  public async cleanup(maxSize: number): Promise<void> {
    try {
      // Delete old files if total size exceeds maxSize
      const files = await fs.readdir(this.config.basePath);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(this.config.basePath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        
        if (totalSize > maxSize) {
          await fs.unlink(filePath);
          mlMetrics.stateUpdates.inc({ type: 'file_deleted' });
        }
      }
      
      logger.info('TrainingDataStorage cleanup completed', { totalSize, maxSize });
    } catch (error) {
      logger.error('Failed to cleanup TrainingDataStorage', { error });
      throw error;
    }
  }

  public async getTrainingData(type: string): Promise<TrainingData | null> {
    try {
      return await this.loadTrainingData(type);
    } catch (error) {
      logger.error('Failed to get training data', { error, type });
      return null;
    }
  }
} 