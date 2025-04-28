export interface InteractionLog {
  timestamp: number;
  type: string;
  action: string;
  success: boolean;
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface StateChangeLog {
  timestamp: number;
  previousState: Record<string, any>;
  newState: Record<string, any>;
  trigger: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface ResourceChangeLog {
  timestamp: number;
  resource: string;
  previousAmount: number;
  newAmount: number;
  change: number;
  source: string;
  metadata?: Record<string, any>;
}

export interface DataVersion {
  version: string;
  timestamp: number;
  size: number;
  format: string;
  schema: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface PredictionRecord {
  timestamp: number;
  modelId: string;
  input: Record<string, any>;
  output: Record<string, any>;
  confidence: number;
  groundTruth?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
}

export interface TrainingData {
  features: Record<string, any>[];
  labels: any[];
  weights?: number[];
  metadata?: Record<string, any>;
}

export interface ProcessedData {
  raw: Record<string, any>;
  processed: Record<string, any>;
  transformations: string[];
  metadata?: Record<string, any>;
} 