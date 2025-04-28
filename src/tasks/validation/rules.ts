import { ValidationRule, ValidationContext, ValidationResult } from './validator';
import { Task } from '@/types/task';
import { Item } from '@/types';

export class InventoryRequirementRule implements ValidationRule {
  constructor(private requiredItems: Item[]) {}

  async validate(task: Task, context: ValidationContext): Promise<ValidationResult> {
    const errors: string[] = [];
    
    for (const requiredItem of this.requiredItems) {
      const hasItem = context.inventory.items.some(item => 
        item.type === requiredItem.type && item.quantity >= requiredItem.quantity
      );
      
      if (!hasItem) {
        errors.push(`Missing required item: ${requiredItem.type} (${requiredItem.quantity} needed)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class ToolRequirementRule implements ValidationRule {
  constructor(private requiredTool: string) {}

  async validate(task: Task, context: ValidationContext): Promise<ValidationResult> {
    const hasTool = context.inventory.items.some(item => 
      item.type === this.requiredTool && item.quantity > 0
    );

    return {
      isValid: hasTool,
      errors: hasTool ? [] : [`Missing required tool: ${this.requiredTool}`]
    };
  }
}

export class LocationRequirementRule implements ValidationRule {
  constructor(
    private requiredPosition: { x: number; y: number; z: number },
    private tolerance: number = 1
  ) {}

  async validate(task: Task, context: ValidationContext): Promise<ValidationResult> {
    const distance = Math.sqrt(
      Math.pow(context.position.x - this.requiredPosition.x, 2) +
      Math.pow(context.position.y - this.requiredPosition.y, 2) +
      Math.pow(context.position.z - this.requiredPosition.z, 2)
    );

    return {
      isValid: distance <= this.tolerance,
      errors: distance > this.tolerance ? ['Not in required location'] : []
    };
  }
}

export class BiomeRequirementRule implements ValidationRule {
  constructor(private requiredBiome: string) {}

  async validate(task: Task, context: ValidationContext): Promise<ValidationResult> {
    return {
      isValid: context.biome === this.requiredBiome,
      errors: context.biome !== this.requiredBiome ? [`Not in required biome: ${this.requiredBiome}`] : []
    };
  }
}

export class TimeRequirementRule implements ValidationRule {
  constructor(private requiredTime: { start: number; end: number }) {}

  async validate(task: Task, context: ValidationContext): Promise<ValidationResult> {
    const isValid = context.time >= this.requiredTime.start && context.time <= this.requiredTime.end;
    
    return {
      isValid,
      errors: isValid ? [] : ['Not within required time range']
    };
  }
} 