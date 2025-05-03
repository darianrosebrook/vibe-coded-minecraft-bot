import { Bot } from 'mineflayer';
import { MLConfig } from '@/ml/config';

/**
 * Interface for ML state management
 */
export interface IMLStateManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  updateStateAsync(): Promise<void>;
  getState(): Promise<any>;
  predictState(): Promise<any>;
}

/**
 * Interface for ML feedback system
 */
export interface IMLFeedbackSystem {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  collectFeedback(): Promise<void>;
  trackSuccess(command: string, executionTime: number, resourceUsage: any): Promise<void>;
  trackFailure(error: Error, context: any): Promise<void>;
  analyzeFailures(): Promise<any>;
}

/**
 * Interface for ML model training
 */
export interface IMLModelTrainer {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  optimizeModels(): Promise<void>;
  trainModel(data: any): Promise<void>;
  evaluateModel(): Promise<any>;
  deployModel(): Promise<void>;
}

/**
 * Interface for data collection
 */
export interface IDataCollector {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  start(): void;
  stop(): void;
  recordPrediction(
    type: string,
    input: any,
    output: any,
    success: boolean,
    confidence: number,
    latency: number,
    metadata?: any
  ): Promise<void>;
  getTrainingData(type: string): any;
}

/**
 * Interface for training data storage
 */
export interface ITrainingDataStorage {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  storeTrainingData(type: string, data: any, version: number): Promise<void>;
  cleanup(maxSize: number): Promise<void>;
  getTrainingData(type: string, version?: number): Promise<any>;
}

/**
 * Base interface for all ML components
 */
export interface IMLComponent {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getConfig(): MLConfig;
}

/**
 * Interface for ML command parser
 */
export interface IMLCommandParser {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  parseCommand(command: string): Promise<any>;
  getConfidence(): number;
  getSuggestions(): string[];
}

/**
 * Interface for ML error detection
 */
export interface IMLErrorDetector {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  predictError(context: any): Promise<{ type: string; severity: number; confidence: number }>;
  analyzeError(error: Error): Promise<any>;
}

/**
 * Interface for ML recovery system
 */
export interface IMLRecoverySystem {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getRecoveryStrategy(error: Error): Promise<any>;
  executeRecovery(strategy: any): Promise<boolean>;
} 