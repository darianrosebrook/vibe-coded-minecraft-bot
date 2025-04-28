import { MLDataManager } from '../storage/MLDataManager';
import { EnhancedGameState } from '../state/types';
import { InteractionLog, StateChangeLog, ResourceChangeLog } from '../data/MLDataCollector';
import * as tf from '@tensorflow/tfjs-node';
import '@tensorflow/tfjs-backend-wasm';
import { DecisionTreeClassifier } from 'ml-cart';
import { RandomForestClassifier } from 'ml-random-forest';

// Initialize TensorFlow.js
async function initializeTF() {
  await tf.setBackend('wasm');
  await tf.ready();
}

// Call initialization
initializeTF().catch(console.error);

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingTime: number;
  inferenceTime: number;
  crossValidationScores: number[];
  featureImportance: Record<string, number>;
  confusionMatrix: number[][];
  trainingDataSize: number;
  validationDataSize: number;
  hyperparameters: Record<string, any>;
}

export interface ModelVersion {
  version: number;
  timestamp: number;
  metrics: ModelMetrics;
  features: string[];
  modelType: string;
  hyperparameters: Record<string, any>;
  trainingDataSize: number;
  validationDataSize: number;
}

export interface TrainingConfig {
  modelType: 'decisionTree' | 'randomForest' | 'neuralNetwork' | 'ensemble';
  features: string[];
  target: string;
  validationSplit: number;
  crossValidationFolds?: number;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  hyperparameters?: Record<string, any>;
  ensembleConfig?: {
    models: ('decisionTree' | 'randomForest' | 'neuralNetwork')[];
    votingStrategy: 'majority' | 'weighted';
    weights?: number[];
  };
}

export interface ABTestConfig {
  modelA: string;
  modelB: string;
  metrics: string[];
  duration: number;
  sampleSize: number;
}

export class MLModelTrainer {
  private dataManager: MLDataManager;
  private models: Map<string, any> = new Map();
  private modelVersions: Map<string, ModelVersion[]> = new Map();
  private currentVersion: Map<string, number> = new Map();
  private abTests: Map<string, ABTestConfig> = new Map();
  private isInitialized: boolean = false;

  constructor(dataManager: MLDataManager) {
    this.dataManager = dataManager;
    this.initializeTensorFlow();
  }

  private async initializeTensorFlow() {
    if (!this.isInitialized) {
      await tf.ready();
      this.isInitialized = true;
    }
  }

  public async trainModel(
    modelName: string,
    config: TrainingConfig
  ): Promise<ModelMetrics> {
    await this.initializeTensorFlow();
    const data = await this.prepareTrainingData(modelName, config);
    const { features, labels } = this.splitFeaturesAndLabels(data);
    
    const model = await this.trainModelByType(config.modelType, features, labels, config);
    this.models.set(modelName, model);

    const metrics = await this.evaluateModel(model, features, labels);
    const version = this.getNextVersion(modelName);
    
    const modelVersion: ModelVersion = {
      version,
      timestamp: Date.now(),
      metrics,
      features: config.features,
      modelType: config.modelType,
      hyperparameters: config.hyperparameters || {},
      trainingDataSize: features.length,
      validationDataSize: Math.floor(features.length * config.validationSplit)
    };

    const versions = this.modelVersions.get(modelName) || [];
    versions.push(modelVersion);
    this.modelVersions.set(modelName, versions);
    this.currentVersion.set(modelName, version);

    return metrics;
  }

  private async performCrossValidation(
    features: any[],
    labels: any[],
    config: TrainingConfig
  ): Promise<number[]> {
    const folds = config.crossValidationFolds || 5;
    const scores: number[] = [];
    const foldSize = Math.floor(features.length / folds);

    for (let i = 0; i < folds; i++) {
      const validationStart = i * foldSize;
      const validationEnd = validationStart + foldSize;

      const trainFeatures = tf.tensor2d([
        ...features.slice(0, validationStart),
        ...features.slice(validationEnd)
      ]);
      const trainLabels = tf.tensor2d([
        ...labels.slice(0, validationStart),
        ...labels.slice(validationEnd)
      ]);
      const validationFeatures = tf.tensor2d(features.slice(validationStart, validationEnd));
      const validationLabels = tf.tensor2d(labels.slice(validationStart, validationEnd));

      const model = await this.trainModelByType(
        config.modelType,
        trainFeatures.arraySync(),
        trainLabels.arraySync(),
        config
      );

      const predictions = await this.makePredictions(model, validationFeatures.arraySync());
      const metrics = await this.calculateMetrics(predictions, validationLabels.arraySync());
      scores.push(metrics.accuracy);

      trainFeatures.dispose();
      trainLabels.dispose();
      validationFeatures.dispose();
      validationLabels.dispose();
    }

    return scores;
  }

  private async calculateFeatureImportance(
    model: any,
    config: TrainingConfig
  ): Promise<Record<string, number>> {
    const importance: Record<string, number> = {};
    const features = config.features;

    for (let i = 0; i < features.length; i++) {
      const featureName = features[i];
      let featureImportance = 0;

      if (config.modelType === 'decisionTree') {
        featureImportance = this.calculateTreeFeatureImportance(model, i);
      } else if (config.modelType === 'neuralNetwork') {
        featureImportance = this.calculateNeuralNetworkFeatureImportance(model.getWeights(), i);
      }

      importance[featureName] = featureImportance;
    }

    return importance;
  }

  private calculateTreeFeatureImportance(tree: any, featureIndex: number): number {
    // Implement tree-based feature importance calculation
    return 0.5; // Placeholder
  }

  private calculateNeuralNetworkFeatureImportance(weights: any, featureIndex: number): number {
    // Implement neural network feature importance calculation
    return 0.5; // Placeholder
  }

  public async startABTest(
    testName: string,
    config: ABTestConfig
  ): Promise<void> {
    this.abTests.set(testName, config);
    // Implement A/B test tracking
  }

  public async getABTestResults(testName: string): Promise<Record<string, any>> {
    const config = this.abTests.get(testName);
    if (!config) {
      throw new Error(`AB test ${testName} not found`);
    }
    
    // Implement A/B test results calculation
    return {
      modelA: await this.getModelMetrics(config.modelA),
      modelB: await this.getModelMetrics(config.modelB),
      winner: 'modelA', // Placeholder
      confidence: 0.95 // Placeholder
    };
  }

  private async prepareTrainingData(
    modelName: string,
    config: TrainingConfig
  ): Promise<any[]> {
    // Generate dummy data for testing
    const numSamples = 100;
    const numFeatures = config.features.length;
    
    return Array.from({ length: numSamples }, () => ({
      features: Array.from({ length: numFeatures }, () => Math.random()),
      label: Math.round(Math.random())
    }));
  }

  private splitFeaturesAndLabels(data: any[]): { features: number[][]; labels: number[] } {
    return {
      features: data.map(d => d.features),
      labels: data.map(d => d.label)
    };
  }

  private async trainModelByType(
    modelType: string,
    features: any[],
    labels: any[],
    config: TrainingConfig
  ): Promise<any> {
    switch (modelType) {
      case 'decisionTree':
        return await this.trainDecisionTree(features, labels);
      case 'randomForest':
        return await this.trainRandomForest(features, labels);
      case 'neuralNetwork':
        return await this.trainNeuralNetwork(features, labels, config);
      case 'ensemble':
        return await this.trainEnsembleModel(features, labels, config);
      default:
        throw new Error(`Unknown model type: ${modelType}`);
    }
  }

  private async trainDecisionTree(features: any[], labels: any[]): Promise<any> {
    const classifier = new DecisionTreeClassifier({
      gainFunction: 'gini',
      maxDepth: 10,
      minNumSamples: 2
    });

    if (features.length === 0 || labels.length === 0) {
      throw new Error('Empty training data');
    }

    classifier.train(features, labels);
    return classifier;
  }

  private async trainRandomForest(features: any[], labels: any[]): Promise<any> {
    const classifier = new RandomForestClassifier({
      nEstimators: 100,
      maxDepth: 10,
      minSamplesSplit: 2
    });

    if (features.length === 0 || labels.length === 0) {
      throw new Error('Empty training data');
    }

    classifier.train(features, labels);
    return classifier;
  }

  private async trainNeuralNetwork(
    features: any[],
    labels: any[],
    config: TrainingConfig
  ): Promise<any> {
    await this.initializeTensorFlow();
    if (features.length === 0 || labels.length === 0) {
      throw new Error('Empty training data');
    }

    const model = tf.sequential();
    
    model.add(tf.layers.dense({
      units: 16,
      inputShape: [features[0].length],
      activation: 'sigmoid'
    }));
    model.add(tf.layers.dense({
      units: 8,
      activation: 'sigmoid'
    }));
    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    }));

    const optimizer = tf.train.adam(config.learningRate || 0.001);
    model.compile({
      optimizer,
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels.map(label => [label]));

    await model.fit(xs, ys, {
      epochs: config.epochs || 20000,
      batchSize: config.batchSize || 32,
      validationSplit: 0.2
    });

    xs.dispose();
    ys.dispose();

    return model;
  }

  private async trainEnsembleModel(
    features: any[],
    labels: any[],
    config: TrainingConfig
  ): Promise<any> {
    if (!config.ensembleConfig) {
      throw new Error('Ensemble configuration is required');
    }

    const models = await Promise.all(
      config.ensembleConfig.models.map(modelType =>
        this.trainModelByType(modelType, features, labels, config)
      )
    );

    return {
      models,
      votingStrategy: config.ensembleConfig.votingStrategy,
      weights: config.ensembleConfig.weights
    };
  }

  private async evaluateModel(
    model: any,
    features: any[],
    labels: any[]
  ): Promise<ModelMetrics> {
    const startTime = Date.now();
    const predictions = await this.makePredictions(model, features);
    const inferenceTime = Date.now() - startTime;

    const metrics = this.calculateMetrics(predictions, labels);
    return {
      ...metrics,
      trainingTime: 0, // This will be set by the training method
      inferenceTime
    };
  }

  private async makePredictions(model: any, features: any[]): Promise<any[]> {
    await this.initializeTensorFlow();
    if (model instanceof DecisionTreeClassifier || model instanceof RandomForestClassifier) {
      return model.predict(features);
    } else if (model instanceof tf.Sequential) {
      const xs = tf.tensor2d(features);
      const predictions = model.predict(xs) as tf.Tensor;
      const result = predictions.arraySync() as number[][];
      xs.dispose();
      predictions.dispose();
      return result.map(p => p[0]);
    } else {
      throw new Error('Unsupported model type');
    }
  }

  private async calculateMetrics(predictions: any[], labels: any[]): Promise<ModelMetrics> {
    await this.initializeTensorFlow();
    const uniqueLabels = new Set([...labels.flat(), ...predictions.flat()]);
    const numClasses = uniqueLabels.size;
    const confusionMatrix = tf.math.confusionMatrix(
      labels.flat(),
      predictions.flat(),
      numClasses
    ).arraySync();
    
    const tp = confusionMatrix[1][1];
    const fp = confusionMatrix[0][1];
    const fn = confusionMatrix[1][0];
    const tn = confusionMatrix[0][0];

    const accuracy = (tp + tn) / (tp + tn + fp + fn);
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    const f1Score = 2 * (precision * recall) / (precision + recall);

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      trainingTime: 0,
      inferenceTime: 0,
      crossValidationScores: [],
      featureImportance: {},
      confusionMatrix,
      trainingDataSize: predictions.length,
      validationDataSize: Math.floor(predictions.length * 0.2),
      hyperparameters: {}
    };
  }

  public async predict(
    modelName: string,
    features: any[]
  ): Promise<any> {
    await this.initializeTensorFlow();
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }
    return this.makePrediction(model, features);
  }

  private async makePrediction(model: any, features: any[]): Promise<any> {
    await this.initializeTensorFlow();
    if (model instanceof DecisionTreeClassifier || model instanceof RandomForestClassifier) {
      return model.predict([features])[0];
    } else if (model instanceof tf.Sequential) {
      const xs = tf.tensor2d([features]);
      const predictions = model.predict(xs) as tf.Tensor;
      const result = predictions.arraySync() as number[][];
      xs.dispose();
      predictions.dispose();
      return result[0][0];
    } else {
      throw new Error('Unsupported model type');
    }
  }

  public getModelVersion(modelName: string): number {
    return this.currentVersion.get(modelName) || 0;
  }

  public getModelMetrics(modelName: string): ModelMetrics | null {
    const versions = this.modelVersions.get(modelName);
    if (!versions || versions.length === 0) return null;
    return versions[versions.length - 1].metrics;
  }

  private getNextVersion(modelName: string): number {
    return (this.currentVersion.get(modelName) || 0) + 1;
  }

  public async rollbackModel(modelName: string, version: number): Promise<boolean> {
    try {
      const versions = this.modelVersions.get(modelName);
      if (!versions || version > versions.length) {
        throw new Error(`Version ${version} does not exist for model ${modelName}`);
      }
      
      this.currentVersion.set(modelName, version);
      // Implement model rollback logic
      return true;
    } catch (error) {
      console.error(`Failed to rollback model ${modelName} to version ${version}:`, error);
      return false;
    }
  }
} 