import * as fs from 'fs/promises';
import * as path from 'path';
import { ModelStorage, StoredModel } from './model_storage';
import { Model } from './models';

// Mock Model class
class MockModel implements Model {
  constructor(
    private weights: number[],
    private bias: number
  ) {}

  getWeights(): number[] {
    return this.weights;
  }

  getBias(): number {
    return this.bias;
  }

  async predict(features: number[]): Promise<number> {
    return 0; // Not needed for testing
  }

  async train(trainData: any, valData: any): Promise<{ loss: number; accuracy: number; validationLoss: number; validationAccuracy: number; }> {
    return {
      loss: 0,
      accuracy: 0,
      validationLoss: 0,
      validationAccuracy: 0
    };
  }

  async save(): Promise<void> {
    // Not needed for testing
  }

  async load(): Promise<void> {
    // Not needed for testing
  }

  getSize(): number {
    return this.weights.length;
  }
}

describe('ModelStorage', () => {
  let storage: ModelStorage;
  const testStoragePath = 'test_models';

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
    storage = new ModelStorage(testStoragePath);
  }, 10000);

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
  }, 10000);

  it('should create storage directory on initialization', async () => {
    const dirExists = await fs.access(testStoragePath)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);
  }, 10000);

  it('should save and load a model', async () => {
    const modelId = 'test_model';
    const model = new MockModel([1, 2, 3], 0.5);
    const metrics = {
      loss: 0.1,
      accuracy: 0.9,
      validationLoss: 0.2,
      validationAccuracy: 0.8
    };

    await storage.saveModel(modelId, model, metrics);
    const loadedModel = await storage.loadModel(modelId);

    expect(loadedModel.modelId).toBe(modelId);
    expect(loadedModel.weights).toEqual([1, 2, 3]);
    expect(loadedModel.bias).toBe(0.5);
    expect(loadedModel.metadata.metrics).toEqual(metrics);
  }, 10000);

  it('should increment version numbers', async () => {
    const modelId = 'test_model';
    const model = new MockModel([1], 0);
    const metrics = {
      loss: 0,
      accuracy: 0,
      validationLoss: 0,
      validationAccuracy: 0
    };

    await storage.saveModel(modelId, model, metrics);
    expect(await storage.getModelVersion(modelId)).toBe(1);

    await storage.saveModel(modelId, model, metrics);
    expect(await storage.getModelVersion(modelId)).toBe(2);
  }, 10000);

  it('should list all models', async () => {
    const model1 = new MockModel([1], 0);
    const model2 = new MockModel([2], 0);
    const metrics = {
      loss: 0,
      accuracy: 0,
      validationLoss: 0,
      validationAccuracy: 0
    };

    await storage.saveModel('model1', model1, metrics);
    await storage.saveModel('model2', model2, metrics);

    const models = await storage.listModels();
    expect(models).toContain('model1');
    expect(models).toContain('model2');
  }, 10000);

  it('should delete a model', async () => {
    const modelId = 'test_model';
    const model = new MockModel([1], 0);
    const metrics = {
      loss: 0,
      accuracy: 0,
      validationLoss: 0,
      validationAccuracy: 0
    };

    await storage.saveModel(modelId, model, metrics);
    expect((await storage.listModels())).toContain(modelId);

    await storage.deleteModel(modelId);
    expect((await storage.listModels())).not.toContain(modelId);
  }, 10000);

  it('should throw error when loading non-existent model', async () => {
    await expect(storage.loadModel('non_existent')).rejects.toThrow();
  }, 10000);
}); 