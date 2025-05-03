import { z } from 'zod';
import { TaskParameters, TaskPriority, TaskStatus, TaskType } from '@/types/task';

import { ValidationRuleEngine } from './validation_rule_engine';
import { TaskContext } from  '../types';

// Base parameter types
export const baseParameterTypes = {
  numeric: z.object({
    type: z.literal('numeric'),
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
    required: z.boolean().optional()
  }),
  string: z.object({
    type: z.literal('string'),
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    required: z.boolean().optional()
  }),
  boolean: z.object({
    type: z.literal('boolean'),
    required: z.boolean().optional()
  }),
  complex: z.object({
    type: z.literal('complex'),
    schema: z.any(),
    required: z.boolean().optional()
  })
};

// Parameter schema type
export type ParameterSchema = z.infer<typeof baseParameterTypes[keyof typeof baseParameterTypes]> & {
  schema?: z.ZodType<any>;
};

// Validation result type
export interface ParameterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedParameters: Record<string, any>;
}

export class ParameterValidator {
  private schemas: Map<string, Record<string, ParameterSchema>> = new Map();
  private validationEngine: ValidationRuleEngine;

  constructor() {
    this.validationEngine = new ValidationRuleEngine();
    this.initializeDefaultSchemas();
  }

  private initializeDefaultSchemas() {
    // Mining parameters
    this.addSchema('mining', {
      block: {
        type: 'string',
        required: true
      },
      quantity: {
        type: 'numeric',
        min: 1,
        integer: true,
        required: true
      },
      tool: {
        type: 'string',
        required: true
      }
    });

    // Crafting parameters
    this.addSchema('crafting', {
      recipe: {
        type: 'string',
        required: true
      },
      materials: {
        type: 'complex',
        schema: z.array(z.string()),
        required: true
      }
    });

    // Navigation parameters
    this.addSchema('navigation', {
      destination: {
        type: 'complex',
        schema: z.object({
          x: z.number(),
          y: z.number(),
          z: z.number()
        }),
        required: true
      },
      path: {
        type: 'complex',
        schema: z.array(z.object({
          x: z.number(),
          y: z.number(),
          z: z.number()
        })),
        required: false
      }
    });
  }

  public addSchema(taskType: string, schema: Record<string, ParameterSchema>) {
    this.schemas.set(taskType, schema);
  }

  public async validateParameters(
    taskType: string,
    parameters: Record<string, any>,
    context: TaskContext
  ): Promise<ParameterValidationResult> {
    const schema = this.schemas.get(taskType);
    if (!schema) {
      return {
        isValid: false,
        errors: [`No schema found for task type: ${taskType}`],
        warnings: [],
        validatedParameters: {}
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedParameters: Record<string, any> = {};

    // Validate each parameter against its schema
    for (const [paramName, paramSchema] of Object.entries(schema)) {
      const value = parameters[paramName];
      
      // Check required parameters
      if (paramSchema.required && value === undefined) {
        errors.push(`Required parameter '${paramName}' is missing`);
        continue;
      }

      // Skip validation for optional parameters that are not provided
      if (!paramSchema.required && value === undefined) {
        continue;
      }

      try {
        // Validate based on parameter type
        switch (paramSchema.type) {
          case 'numeric':
            validatedParameters[paramName] = this.validateNumeric(value, paramSchema);
            break;
          case 'string':
            validatedParameters[paramName] = this.validateString(value, paramSchema);
            break;
          case 'boolean':
            validatedParameters[paramName] = this.validateBoolean(value);
            break;
          case 'complex':
            validatedParameters[paramName] = this.validateComplex(value, paramSchema);
            break;
          default:
            errors.push(`Invalid parameter type for '${paramName}': ${(paramSchema as { type: string }).type}`);
        }
      } catch (error) {
        errors.push(`Validation failed for parameter '${paramName}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Run additional validation rules from the engine
    const task = { 
      type: taskType as TaskType, 
      parameters: validatedParameters as TaskParameters, 
      status: TaskStatus.PENDING,
      id: crypto.randomUUID(),
      priority: TaskPriority.MEDIUM,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const ruleResult = await this.validationEngine.validateTask(task, context);
    
    if (!ruleResult.isValid) {
      errors.push(...ruleResult.errors.map(e => e.message));
      warnings.push(...ruleResult.warnings.map(w => w.message));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedParameters: validatedParameters
    };
  }

  private validateNumeric(value: any, schema: ParameterSchema): number {
    if (schema.type !== 'numeric') {
      throw new Error('Schema type must be numeric');
    }
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error('Value must be a number');
    }

    if (schema.min !== undefined && num < schema.min) {
      throw new Error(`Value must be at least ${schema.min}`);
    }

    if (schema.max !== undefined && num > schema.max) {
      throw new Error(`Value must be at most ${schema.max}`);
    }

    if (schema.integer && !Number.isInteger(num)) {
      throw new Error('Value must be an integer');
    }

    return num;
  }

  private validateString(value: any, schema: ParameterSchema): string {
    if (schema.type !== 'string') {
      throw new Error('Schema type must be string');
    }
    const str = String(value);

    if (schema.minLength !== undefined && str.length < schema.minLength) {
      throw new Error(`String must be at least ${schema.minLength} characters long`);
    }

    if (schema.maxLength !== undefined && str.length > schema.maxLength) {
      throw new Error(`String must be at most ${schema.maxLength} characters long`);
    }

    if (schema.pattern && !new RegExp(schema.pattern).test(str)) {
      throw new Error(`String must match pattern: ${schema.pattern}`);
    }

    return str;
  }

  private validateBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    throw new Error('Value must be a boolean');
  }

  private validateComplex(value: any, schema: ParameterSchema): any {
    if (schema.type !== 'complex') {
      throw new Error('Schema type must be complex');
    }
    if (!schema.schema) {
      throw new Error('Complex schema must have a schema definition');
    }

    try {
      if (schema.schema instanceof z.ZodType) {
        return schema.schema.parse(value);
      }
      // Handle nested schema definitions
      if (typeof schema.schema === 'object') {
        const result: Record<string, any> = {};
        for (const [key, subSchema] of Object.entries(schema.schema)) {
          if (typeof subSchema === 'string') {
            switch (subSchema) {
              case 'string':
                result[key] = this.validateString(value[key], { type: 'string' });
                break;
              case 'number':
                result[key] = this.validateNumeric(value[key], { type: 'numeric' });
                break;
              case 'boolean':
                result[key] = this.validateBoolean(value[key]);
                break;
              default:
                throw new Error(`Unknown schema type: ${subSchema}`);
            }
          } else if (typeof subSchema === 'object') {
            result[key] = this.validateComplex(value[key], { type: 'complex', schema: subSchema });
          }
        }
        return result;
      }
      throw new Error('Invalid complex schema definition');
    } catch (error) {
      throw new Error(`Complex validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 