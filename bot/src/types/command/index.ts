import { Vec3 } from 'vec3';
import { Inventory } from '@/types/inventory';
import { TaskHistory } from '@/types/ml/state';
import { CommandContext as MLCommandContext } from '@/types/ml/command';

export type CommandContext = MLCommandContext;

export interface CommandPattern {
  pattern: string;
  intent: string;
  parameters: Record<string, string>;
  examples: string[];
  context: CommandContext;
  metadata?: {
    confidence: number;
    updateTimestamp: number;
    createdTimestamp?: number;
    usageCount?: number;
  };
} 