import * as fs from 'fs/promises';
import * as path from 'path';
import { Model } from './models';
import { mlMetrics } from '../../utils/observability/metrics';

export interface StoredModel {
  modelId: string;
  metadata: {
    version: number;
    timestamp: number;
    metrics: {
      loss: number;
      accuracy: number;
      validationLoss: number;
      validationAccuracy: number;
    };
  };
  weights: number[];
  bias: number;
}

export class ModelStorage {
  private storagePath: string;
  private models: Map<string, StoredModel>;
  private initialized: Promise<void>;

  constructor(storagePath: string = 'data/models') {
    this.storagePath = storagePath;
    this.models = new Map();
    this.initialized = this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.ensureStorageDirectory();
    await this.loadModels();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      console.error('Error creating storage directory:', error);
      throw error;
    }
  }

  private async loadModels(): Promise<void> {
    try {
      const files = await fs.readdir(this.storagePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const modelId = path.basename(file, '.json');
          const data = await fs.readFile(path.join(this.storagePath, file), 'utf-8');
          const model = JSON.parse(data) as StoredModel;
          this.models.set(modelId, model);
        }
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        // Directory doesn't exist yet, which is fine
        return;
      }
      console.error('Error loading models:', error);
      throw error;
    }
  }

  public async saveModel(modelId: string, model: Model, metrics: StoredModel['metadata']['metrics']): Promise<void> {
    await this.initialized;
    try {
      const storedModel: StoredModel = {
        modelId,
        metadata: {
          version: this.getNextVersion(modelId),
          timestamp: Date.now(),
          metrics
        },
        weights: model.getWeights(),
        bias: model.getBias()
      };

      const filePath = path.join(this.storagePath, `${modelId}.json`);
      await fs.writeFile(filePath, JSON.stringify(storedModel, null, 2));
      this.models.set(modelId, storedModel);

      mlMetrics.stateUpdates.inc({ type: 'model_saved' });
    } catch (error) {
      console.error('Error saving model:', error);
      mlMetrics.stateUpdates.inc({ type: 'model_save_error' });
      throw error;
    }
  }

  public async loadModel(modelId: string): Promise<StoredModel> {
    await this.initialized;
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    mlMetrics.stateUpdates.inc({ type: 'model_loaded' });
    return model;
  }

  public async deleteModel(modelId: string): Promise<void> {
    await this.initialized;
    try {
      const filePath = path.join(this.storagePath, `${modelId}.json`);
      await fs.unlink(filePath);
      this.models.delete(modelId);
      mlMetrics.stateUpdates.inc({ type: 'model_deleted' });
    } catch (error) {
      console.error('Error deleting model:', error);
      mlMetrics.stateUpdates.inc({ type: 'model_delete_error' });
      throw error;
    }
  }

  public async getModelVersion(modelId: string): Promise<number> {
    await this.initialized;
    const model = this.models.get(modelId);
    return model ? model.metadata.version : 0;
  }

  private getNextVersion(modelId: string): number {
    const version = this.models.get(modelId)?.metadata.version ?? 0;
    return version + 1;
  }

  public async listModels(): Promise<string[]> {
    await this.initialized;
    return Array.from(this.models.keys());
  }
} 