import { TaskContext } from '@/types';

export interface IntentClassification {
  intent: string;
  confidence: number;
  parameters: Record<string, any>;
  alternatives: Array<{
    intent: string;
    confidence: number;
    parameters: Record<string, any>;
  }>;
}

export interface SimilarCommand {
  command: string;
  similarity: number;
  intent: string;
  parameters: Record<string, any>;
}

export interface ErrorPrediction {
  likelihood: number;
  potentialErrors: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    preventionSteps: string[];
  }>;
}

export interface ResponseQuality {
  score: number;
  metrics: {
    clarity: number;
    specificity: number;
    completeness: number;
    relevance: number;
  };
  suggestions: string[];
}

export interface CommandPattern {
  pattern: string;
  intent: string;
  parameters: Record<string, string>;
  examples: string[];
  confidence: number;
}

export interface MLCommandParser {
  classifyIntent(command: string, context: TaskContext): Promise<IntentClassification>;
  findSimilarCommands(command: string): Promise<SimilarCommand[]>;
  predictError(command: string, context: TaskContext): Promise<ErrorPrediction>;
}

export interface MLResponseGenerator {
  generateResponse(command: string, context: TaskContext): Promise<string>;
  scoreResponse(response: string): Promise<ResponseQuality>;
  optimizeResponse(response: string): Promise<string>;
}

export interface MLErrorHandler {
  predictErrors(command: string, context: TaskContext): Promise<ErrorPrediction[]>;
  suggestCorrections(error: Error): Promise<string[]>;
  selectRecoveryStrategy(error: Error): Promise<string>;
}

export interface PatternRecognitionSystem {
  addCommandSequence(sequence: string[]): void;
  identifyCommonSequences(): string[][];
  learnFromSuccessfulPatterns(successfulCommands: string[]): void;
  getPatterns(): CommandPattern[];
} 