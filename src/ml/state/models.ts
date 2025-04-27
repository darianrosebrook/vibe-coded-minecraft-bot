import { GameState } from '../../llm/context/manager';
import { metrics } from '../../utils/observability/metrics'; 
import { ModelStorage, StoredModel } from './model_storage';
import { ProcessedData } from './data_preprocessor';

interface PredictionHistory {
  timestamp: number;
  prediction: any;
  actual: any;
  confidence: number;
}

export interface Model {
  predict(features: number[]): Promise<number>;
  train(trainData: ProcessedData, valData: ProcessedData): Promise<{
    loss: number;
    accuracy: number;
    validationLoss: number;
    validationAccuracy: number;
  }>;
  save(storage: ModelStorage, modelId: string, metrics: StoredModel['metadata']['metrics']): Promise<void>;
  load(storage: ModelStorage, modelId: string): Promise<void>;
  getSize(): number;
  getWeights(): number[];
  getBias(): number;
}

export abstract class BaseModel implements Model {
  protected weights: number[];
  protected bias: number;
  protected learningRate: number;

  constructor(learningRate: number = 0.001) {
    this.weights = [];
    this.bias = 0;
    this.learningRate = learningRate;
  }

  public abstract predict(features: number[]): Promise<number>;

  public async train(
    trainData: ProcessedData,
    valData: ProcessedData
  ): Promise<{
    loss: number;
    accuracy: number;
    validationLoss: number;
    validationAccuracy: number;
  }> {
    if (this.weights.length === 0) {
      this.initializeWeights(trainData.features.length / trainData.labels.length);
    }

    const batchSize = 32;
    const epochs = 10;
    let bestValLoss = Infinity;
    let patience = 3;
    let noImprovementEpochs = 0;
    let finalLoss = 0;
    let finalAccuracy = 0;
    let finalValLoss = 0;
    let finalValAccuracy = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      // Training
      let totalLoss = 0;
      let correctPredictions = 0;

      for (let i = 0; i < trainData.features.length; i += batchSize) {
        const batchFeatures = trainData.features.slice(i, i + batchSize);
        const batchLabels = trainData.labels.slice(i, i + batchSize);

        for (let j = 0; j < batchFeatures.length; j++) {
          const prediction = await this.predict([batchFeatures[j]]);
          const error = batchLabels[j] - prediction;
          
          // Update weights
          this.weights = this.weights.map((weight, k) => 
            weight + this.learningRate * error * batchFeatures[j]);
          this.bias += this.learningRate * error;

          totalLoss += Math.pow(error, 2);
          correctPredictions += Math.abs(prediction - batchLabels[j]) < 0.5 ? 1 : 0;
        }
      }

      finalLoss = totalLoss / trainData.features.length;
      finalAccuracy = correctPredictions / trainData.features.length;

      // Validation
      let valLoss = 0;
      let valCorrect = 0;

      for (let i = 0; i < valData.features.length; i++) {
        const prediction = await this.predict([valData.features[i]]);
        const error = valData.labels[i] - prediction;
        valLoss += Math.pow(error, 2);
        valCorrect += Math.abs(prediction - valData.labels[i]) < 0.5 ? 1 : 0;
      }

      finalValLoss = valLoss / valData.features.length;
      finalValAccuracy = valCorrect / valData.features.length;

      // Early stopping
      if (finalValLoss < bestValLoss) {
        bestValLoss = finalValLoss;
        noImprovementEpochs = 0;
      } else {
        noImprovementEpochs++;
        if (noImprovementEpochs >= patience) {
          break;
        }
      }
    }

    return {
      loss: finalLoss,
      accuracy: finalAccuracy,
      validationLoss: finalValLoss,
      validationAccuracy: finalValAccuracy
    };
  }

  public async save(
    storage: ModelStorage,
    modelId: string,
    metrics: StoredModel['metadata']['metrics']
  ): Promise<void> {
    await storage.saveModel(modelId, this, metrics);
  }

  public async load(storage: ModelStorage, modelId: string): Promise<void> {
    const storedModel = await storage.loadModel(modelId);
    this.weights = storedModel.weights;
    this.bias = storedModel.bias;
  }

  public getSize(): number {
    return (this.weights.length * 8) + 8; // 8 bytes per number (64-bit float)
  }

  protected initializeWeights(featureCount: number): void {
    this.weights = Array(featureCount).fill(0).map(() => 
      (Math.random() * 2 - 1) * 0.01);
  }

  protected sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  public getWeights(): number[] {
    return this.weights;
  }

  public getBias(): number {
    return this.bias;
  }
}

export class ResourceNeedModel extends BaseModel {
  public async predict(features: number[]): Promise<number> {
    if (this.weights.length === 0) {
      this.initializeWeights(features.length);
    }

    const prediction = this.weights.reduce((sum, weight, i) => 
      sum + weight * features[i], this.bias);
    return this.sigmoid(prediction);
  }
}

export class PlayerRequestModel extends BaseModel {
  public async predict(features: number[]): Promise<number> {
    if (this.weights.length === 0) {
      this.initializeWeights(features.length);
    }

    const prediction = this.weights.reduce((sum, weight, i) => 
      sum + weight * features[i], this.bias);
    return this.sigmoid(prediction);
  }
}

export class TaskDurationModel extends BaseModel {
  public async predict(features: number[]): Promise<number> {
    if (this.weights.length === 0) {
      this.initializeWeights(features.length);
    }

    const prediction = this.weights.reduce((sum, weight, i) => 
      sum + weight * features[i], this.bias);
    return this.sigmoid(prediction);
  }
}

export class ResourceNeedPredictor {
  private history: PredictionHistory[] = [];
  private readonly maxHistorySize = 1000;

  public async predict(gameState: GameState): Promise<{
    type: string;
    quantity: number;
    confidence: number;
  }[]> {
    // Analyze inventory and recent tasks to predict resource needs
    const predictions: {
      type: string;
      quantity: number;
      confidence: number;
    }[] = [];

    // Check inventory levels
    const inventory = gameState.inventory;
    const usedSlots = inventory.usedSlots;
    const totalSlots = inventory.totalSlots;
    const inventoryRatio = usedSlots / totalSlots;

    // If inventory is getting full, predict need for storage items
    if (inventoryRatio > 0.8) {
      predictions.push({
        type: 'chest',
        quantity: Math.ceil((inventoryRatio - 0.8) * totalSlots / 27), // 27 slots per chest
        confidence: 0.8
      });
    }

    // Analyze recent tasks for resource patterns
    const recentTasks = gameState.recentTasks || [];
    const taskResourcePatterns = this.analyzeTaskPatterns(recentTasks);
    
    // Add predictions based on task patterns
    for (const [resource, { quantity, confidence }] of Object.entries(taskResourcePatterns)) {
      predictions.push({
        type: resource,
        quantity,
        confidence
      });
    }

    // Record prediction for future learning
    this.recordPrediction(predictions);

    return predictions;
  }

  private analyzeTaskPatterns(tasks: any[]): Record<string, { quantity: number; confidence: number }> {
    const patterns: Record<string, { quantity: number; confidence: number }> = {};
    
    // Group tasks by type and analyze resource usage
    const taskGroups = tasks.reduce((acc, task) => {
      if (!acc[task.type]) {
        acc[task.type] = [];
      }
      acc[task.type].push(task);
      return acc;
    }, {} as Record<string, any[]>);

    // Analyze each task group
    for (const [taskType, taskList] of Object.entries(taskGroups)) {
      const resourceUsage = this.analyzeResourceUsage(taskType, taskList as any[]);
      for (const [resource, usage] of Object.entries(resourceUsage)) {
        if (!patterns[resource]) {
          patterns[resource] = { quantity: 0, confidence: 0 };
        }
        patterns[resource].quantity += usage.quantity;
        patterns[resource].confidence = Math.max(patterns[resource].confidence, usage.confidence);
      }
    }

    return patterns;
  }

  private analyzeResourceUsage(taskType: string, tasks: any[]): Record<string, { quantity: number; confidence: number }> {
    // TODO: Implement more sophisticated resource usage analysis
    // For now, return simple patterns based on task type
    const patterns: Record<string, { quantity: number; confidence: number }> = {};
    
    switch (taskType) {
      case 'mining':
        patterns['diamond_pickaxe'] = { quantity: 1, confidence: 0.9 };
        patterns['torch'] = { quantity: 64, confidence: 0.8 };
        break;
      case 'farming':
        patterns['wheat_seeds'] = { quantity: 64, confidence: 0.7 };
        patterns['bone_meal'] = { quantity: 32, confidence: 0.6 };
        break;
      case 'combat':
        patterns['diamond_sword'] = { quantity: 1, confidence: 0.9 };
        patterns['shield'] = { quantity: 1, confidence: 0.8 };
        break;
    }

    return patterns;
  }

  private recordPrediction(predictions: any[]): void {
    this.history.push({
      timestamp: Date.now(),
      prediction: predictions,
      actual: null, // Will be updated when actual results are known
      confidence: predictions.reduce((max, p) => Math.max(max, p.confidence), 0)
    });

    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }
}

export class PlayerRequestPredictor {
  private history: PredictionHistory[] = [];
  private readonly maxHistorySize = 1000;

  public async predict(gameState: GameState): Promise<{
    type: string;
    confidence: number;
    expectedTime: number;
  }[]> {
    const predictions: {
      type: string;
      confidence: number;
      expectedTime: number;
    }[] = [];

    // Analyze time of day for common request patterns
    const timeOfDay = gameState.timeOfDay;
    const isDay = timeOfDay < 13000 || timeOfDay > 23000;

    if (isDay) {
      // Daytime activities
      predictions.push({
        type: 'mining',
        confidence: 0.7,
        expectedTime: 300000 // 5 minutes
      });
      predictions.push({
        type: 'farming',
        confidence: 0.6,
        expectedTime: 180000 // 3 minutes
      });
    } else {
      // Nighttime activities
      predictions.push({
        type: 'combat',
        confidence: 0.8,
        expectedTime: 240000 // 4 minutes
      });
    }

    // Analyze recent tasks for request patterns
    const recentTasks = gameState.recentTasks || [];
    const taskPatterns = this.analyzeTaskPatterns(recentTasks);
    predictions.push(...taskPatterns);

    // Record prediction for future learning
    this.recordPrediction(predictions);

    return predictions;
  }

  private analyzeTaskPatterns(tasks: any[]): {
    type: string;
    confidence: number;
    expectedTime: number;
  }[] {
    const patterns: {
      type: string;
      confidence: number;
      expectedTime: number;
    }[] = [];

    // Group tasks by type and analyze patterns
    const taskGroups = tasks.reduce((acc, task) => {
      if (!acc[task.type]) {
        acc[task.type] = [];
      }
      acc[task.type].push(task);
      return acc;
    }, {} as Record<string, any[]>);

    // Analyze each task group
    for (const [taskType, taskList] of Object.entries(taskGroups)) {
      const pattern = this.analyzeTaskTypePattern(taskType, taskList as any[]);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private analyzeTaskTypePattern(taskType: string, tasks: any[]): {
    type: string;
    confidence: number;
    expectedTime: number;
  } | null {
    // TODO: Implement more sophisticated pattern analysis
    // For now, return simple patterns based on task type
    switch (taskType) {
      case 'mining':
        return {
          type: 'mining',
          confidence: 0.7,
          expectedTime: 300000
        };
      case 'farming':
        return {
          type: 'farming',
          confidence: 0.6,
          expectedTime: 180000
        };
      case 'combat':
        return {
          type: 'combat',
          confidence: 0.8,
          expectedTime: 240000
        };
      default:
        return null;
    }
  }

  private recordPrediction(predictions: any[]): void {
    this.history.push({
      timestamp: Date.now(),
      prediction: predictions,
      actual: null, // Will be updated when actual results are known
      confidence: predictions.reduce((max, p) => Math.max(max, p.confidence), 0)
    });

    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }
}

export class TaskDurationPredictor {
  private history: PredictionHistory[] = [];
  private readonly maxHistorySize = 1000;

  public async predict(gameState: GameState): Promise<{
    taskType: string;
    expectedDuration: number;
    confidence: number;
  }[]> {
    const predictions: {
      taskType: string;
      expectedDuration: number;
      confidence: number;
    }[] = [];

    // Analyze recent tasks for duration patterns
    const recentTasks = gameState.recentTasks || [];
    const durationPatterns = this.analyzeDurationPatterns(recentTasks);
    predictions.push(...durationPatterns);

    // Record prediction for future learning
    this.recordPrediction(predictions);

    return predictions;
  }

  private analyzeDurationPatterns(tasks: any[]): {
    taskType: string;
    expectedDuration: number;
    confidence: number;
  }[] {
    const patterns: {
      taskType: string;
      expectedDuration: number;
      confidence: number;
    }[] = [];

    // Group tasks by type and analyze duration patterns
    const taskGroups = tasks.reduce((acc, task) => {
      if (!acc[task.type]) {
        acc[task.type] = [];
      }
      acc[task.type].push(task);
      return acc;
    }, {} as Record<string, any[]>);

    // Analyze each task group
    for (const [taskType, taskList] of Object.entries(taskGroups)) {
      const pattern = this.analyzeTaskDurationPattern(taskType, taskList as any[]);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private analyzeTaskDurationPattern(taskType: string, tasks: any[]): {
    taskType: string;
    expectedDuration: number;
    confidence: number;
  } | null {
    // Calculate average duration for this task type
    const durations = tasks
      .filter(task => task.duration)
      .map(task => task.duration);
    
    if (durations.length === 0) {
      return null;
    }

    const avgDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    const variance = durations.reduce((sum, duration) => sum + Math.pow(duration - avgDuration, 2), 0) / durations.length;
    const confidence = Math.max(0, 1 - Math.sqrt(variance) / avgDuration);

    return {
      taskType,
      expectedDuration: avgDuration,
      confidence
    };
  }

  private recordPrediction(predictions: any[]): void {
    this.history.push({
      timestamp: Date.now(),
      prediction: predictions,
      actual: null, // Will be updated when actual results are known
      confidence: predictions.reduce((max, p) => Math.max(max, p.confidence), 0)
    });

    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }
} 