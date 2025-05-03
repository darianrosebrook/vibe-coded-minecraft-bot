import { TaskParameters } from "@/types/task";
import { TaskPriority } from "@/types/task";

export interface Task {
  id: string;
  type: string;
  priority?: TaskPriority;
  dependencies?: string[];
  data?: Record<string, unknown>;
  parameters: TaskParameters;
  retry?: {
    maxAttempts: number;
    backoff: number;
    maxDelay: number;
  };
  progress?: number;
  requirements?: {
    items?: Array<{
      type: string;
      quantity: number;
    }>;
    tools?: Array<{
      type: string;
    }>;
  };
} 