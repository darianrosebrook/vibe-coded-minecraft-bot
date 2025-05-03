export interface FeedbackData {
  timestamp: number;
  type: string;
  source: string;
  content: Record<string, any>;
  rating?: number;
  metadata?: Record<string, any>;
}

export interface LearningMetrics {
  accuracy: number;
  loss: number;
  validationAccuracy: number;
  validationLoss: number;
  learningRate: number;
  batchSize: number;
  epoch: number;
  timestamp: number;
}

export interface ModelUpdateTrigger {
  type: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface SuccessMetrics {
  rate: number;
  confidence: number;
  duration: number;
  resourceUsage: Record<string, number>;
  patterns: SuccessPattern[];
}

export interface SuccessPattern {
  type: string;
  frequency: number;
  confidence: number;
  conditions: Record<string, any>;
}

export interface FailureAnalysis {
  type: string;
  frequency: number;
  impact: number;
  rootCause: string;
  recoveryAttempts: RecoveryAttempt[];
}

export interface RecoveryAttempt {
  method: string;
  success: boolean;
  duration: number;
  newState?: string;
} 