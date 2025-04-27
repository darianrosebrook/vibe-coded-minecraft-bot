export interface Task {
  id: string;
  type: string;
  data: Record<string, any>;
  parameters: Record<string, any>;
  priority: number;
  timeout?: number;
  retry?: {
    maxAttempts: number;
    backoff: number;
    maxDelay: number;
  };
  requirements?: {
    items?: Array<{
      type: string;
      quantity: number;
      required: boolean;
    }>;
    tools?: Array<{
      type: string;
      material: string;
      required: boolean;
    }>;
    blocks?: Array<{
      type: string;
      quantity: number;
      required: boolean;
    }>;
    entities?: Array<{
      type: string;
      quantity: number;
      required: boolean;
    }>;
  };
  validation?: {
    preChecks?: Array<{
      type: string;
      condition: string;
      error: string;
    }>;
    postChecks?: Array<{
      type: string;
      condition: string;
      error: string;
    }>;
  };
  dependencies?: Array<{
    type: string;
    parameters: Record<string, any>;
    required: boolean;
  }>;
} 