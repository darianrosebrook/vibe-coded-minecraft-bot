/**
 * ML Validation Types
 * 
 * This file defines types related to ML state validation, prediction evaluation,
 * and context weighting mechanisms.
 */

/**
 * Validation rules for ML state integrity
 */
export interface MLStateValidation {
  checks: Array<{
    property: string;
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    customValidator?: (value: any) => boolean;
  }>;
  dependencies: Array<{
    property: string;
    dependsOn: string;
    condition?: (value: any, dependencyValue: any) => boolean;
  }>;
  lastValidated?: number;
  isValid: boolean;
  errors?: string[];
}

/**
 * ML prediction and confidence tracking
 */
export interface MLStatePrediction {
  predictionType: string;
  timestamp: number;
  inputs: Record<string, any>;
  prediction: any;
  confidence: number;
  groundTruth?: any;
  error?: number;
  metadata?: Record<string, any>;
}

/**
 * Context weight for determining importance of different state aspects
 */
export interface ContextWeight {
  category: string;
  baseWeight: number;
  decayRate: number;
  maxWeight: number;
  currentWeight?: number;
  lastUpdated?: number;
  relevance?: number;
}

/**
 * Validation result for ML models
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    precision?: number;
    recall?: number;
    f1Score?: number;
    accuracy?: number;
    meanError?: number;
  };
  timestamp: number;
} 