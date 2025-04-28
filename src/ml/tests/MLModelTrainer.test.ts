import { MLModelTrainer } from '../training/MLModelTrainer';
import { MLDataManager } from '../storage/MLDataManager';
import { TrainingConfig, ABTestConfig } from '../training/MLModelTrainer';
import * as tf from '@tensorflow/tfjs-node';

describe('MLModelTrainer Tests', () => {
  let modelTrainer: MLModelTrainer;
  let dataManager: MLDataManager;

  beforeAll(async () => {
    await tf.ready();
  });

  beforeEach(() => {
    dataManager = new MLDataManager();
    modelTrainer = new MLModelTrainer(dataManager);
  });

  describe('Model Training', () => {
    it('should train a command understanding model with cross-validation', async () => {
      const config: TrainingConfig = {
        modelType: 'decisionTree',
        features: ['commandLength', 'timeOfDay', 'biome'],
        target: 'success',
        validationSplit: 0.2,
        crossValidationFolds: 5
      };

      const metrics = await modelTrainer.trainModel('commandUnderstanding', config);
      expect(metrics).toBeDefined();
      expect(metrics.crossValidationScores).toHaveLength(5);
      expect(metrics.crossValidationScores.every(score => score >= 0)).toBe(true);
      expect(metrics.featureImportance).toBeDefined();
      expect(Object.keys(metrics.featureImportance)).toEqual(config.features);
    });

    it('should train a state prediction model with feature scaling', async () => {
      const config: TrainingConfig = {
        modelType: 'randomForest',
        features: ['positionChange', 'healthChange', 'inventoryChange'],
        target: 'nextState',
        validationSplit: 0.2,
        hyperparameters: {
          nEstimators: 100,
          maxDepth: 10
        }
      };

      const metrics = await modelTrainer.trainModel('statePrediction', config);
      expect(metrics).toBeDefined();
      expect(metrics.featureImportance).toBeDefined();
      expect(metrics.confusionMatrix).toBeDefined();
    });

    it('should train a resource prediction model with PCA', async () => {
      const config: TrainingConfig = {
        modelType: 'neuralNetwork',
        features: Array(15).fill(0).map((_, i) => `feature${i}`),
        target: 'nextQuantity',
        validationSplit: 0.2,
        epochs: 10,
        batchSize: 32,
        learningRate: 0.001
      };

      const metrics = await modelTrainer.trainModel('resourcePrediction', config);
      expect(metrics).toBeDefined();
      expect(metrics.featureImportance).toBeDefined();
    });

    it('should train an ensemble model', async () => {
      const config: TrainingConfig = {
        modelType: 'ensemble',
        features: ['commandLength', 'timeOfDay', 'biome'],
        target: 'success',
        validationSplit: 0.2,
        ensembleConfig: {
          models: ['decisionTree', 'randomForest', 'neuralNetwork'],
          votingStrategy: 'weighted',
          weights: [0.3, 0.3, 0.4]
        }
      };

      const metrics = await modelTrainer.trainModel('ensembleModel', config);
      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Model Prediction', () => {
    it('should make predictions with a trained model', async () => {
      const config: TrainingConfig = {
        modelType: 'decisionTree',
        features: ['commandLength', 'timeOfDay', 'biome'],
        target: 'success',
        validationSplit: 0.2
      };

      await modelTrainer.trainModel('commandUnderstanding', config);
      const prediction = await modelTrainer.predict('commandUnderstanding', [
        10, // commandLength
        6000, // timeOfDay
        'plains' // biome
      ]);

      expect(prediction).toBeDefined();
    });

    it('should handle feature scaling in predictions', async () => {
      const config: TrainingConfig = {
        modelType: 'neuralNetwork',
        features: ['positionChange', 'healthChange'],
        target: 'nextState',
        validationSplit: 0.2
      };

      await modelTrainer.trainModel('statePrediction', config);
      const prediction = await modelTrainer.predict('statePrediction', [100, 20]);
      expect(prediction).toBeDefined();
    });
  });

  describe('Model Versioning', () => {
    it('should track model versions with detailed metrics', async () => {
      const config: TrainingConfig = {
        modelType: 'decisionTree',
        features: ['commandLength', 'timeOfDay', 'biome'],
        target: 'success',
        validationSplit: 0.2
      };

      await modelTrainer.trainModel('commandUnderstanding', config);
      const version = modelTrainer.getModelVersion('commandUnderstanding');
      expect(version).toBe(1);

      const metrics = modelTrainer.getModelMetrics('commandUnderstanding');
      expect(metrics).toBeDefined();
      expect(metrics?.trainingDataSize).toBeGreaterThan(0);
      expect(metrics?.validationDataSize).toBeGreaterThan(0);
      expect(metrics?.hyperparameters).toBeDefined();
    });
  });

  describe('A/B Testing', () => {
    it('should conduct A/B tests between models', async () => {
      const configA: TrainingConfig = {
        modelType: 'decisionTree',
        features: ['commandLength', 'timeOfDay', 'biome'],
        target: 'success',
        validationSplit: 0.2
      };

      const configB: TrainingConfig = {
        modelType: 'randomForest',
        features: ['commandLength', 'timeOfDay', 'biome'],
        target: 'success',
        validationSplit: 0.2
      };

      await modelTrainer.trainModel('modelA', configA);
      await modelTrainer.trainModel('modelB', configB);

      const abTestConfig: ABTestConfig = {
        modelA: 'modelA',
        modelB: 'modelB',
        metrics: ['accuracy', 'precision', 'recall'],
        duration: 3600000, // 1 hour
        sampleSize: 1000
      };

      await modelTrainer.startABTest('test1', abTestConfig);
      const results = await modelTrainer.getABTestResults('test1');
      
      expect(results).toBeDefined();
      expect(results.modelA).toBeDefined();
      expect(results.modelB).toBeDefined();
      expect(results.winner).toBeDefined();
      expect(results.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Model Rollback', () => {
    it('should rollback to a previous model version with metrics', async () => {
      const config: TrainingConfig = {
        modelType: 'decisionTree',
        features: ['commandLength', 'timeOfDay', 'biome'],
        target: 'success',
        validationSplit: 0.2
      };

      await modelTrainer.trainModel('commandUnderstanding', config);
      const metrics1 = modelTrainer.getModelMetrics('commandUnderstanding');
      
      await modelTrainer.trainModel('commandUnderstanding', config);
      const metrics2 = modelTrainer.getModelMetrics('commandUnderstanding');
      
      const success = await modelTrainer.rollbackModel('commandUnderstanding', 1);
      expect(success).toBe(true);
      expect(modelTrainer.getModelVersion('commandUnderstanding')).toBe(1);
      
      const metricsAfterRollback = modelTrainer.getModelMetrics('commandUnderstanding');
      expect(metricsAfterRollback).toEqual(metrics1);
    });
  });

  describe('Feature Importance', () => {
    it('should calculate feature importance for different model types', async () => {
      const configs = [
        {
          modelType: 'decisionTree' as const,
          features: ['feature1', 'feature2', 'feature3'],
          target: 'success',
          validationSplit: 0.2
        },
        {
          modelType: 'randomForest' as const,
          features: ['feature1', 'feature2', 'feature3'],
          target: 'success',
          validationSplit: 0.2
        },
        {
          modelType: 'neuralNetwork' as const,
          features: ['feature1', 'feature2', 'feature3'],
          target: 'success',
          validationSplit: 0.2
        }
      ];

      for (const config of configs) {
        const metrics = await modelTrainer.trainModel(`model_${config.modelType}`, config);
        expect(metrics.featureImportance).toBeDefined();
        expect(Object.keys(metrics.featureImportance)).toEqual(config.features);
        expect(Object.values(metrics.featureImportance).every(v => v >= 0)).toBe(true);
      }
    });
  });
}); 