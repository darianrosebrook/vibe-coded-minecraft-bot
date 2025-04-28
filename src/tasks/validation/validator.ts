  import { Task } from '@/types/task';
import { Position } from '@/types/common';
import { Inventory } from '@/types';

export interface ValidationRule {
  validate(task: Task, context: ValidationContext): Promise<ValidationResult>;
}

export interface ValidationContext {
  inventory: Inventory;
  position: Position;
  biome: string;
  time: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class TaskValidator {
  private rules: ValidationRule[] = [];

  constructor(rules: ValidationRule[] = []) {
    this.rules = rules;
  }

  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  async validate(task: Task, context: ValidationContext): Promise<ValidationResult> {
    const errors: string[] = [];
    
    for (const rule of this.rules) {
      const result = await rule.validate(task, context);
      if (!result.isValid) {
        errors.push(...result.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 