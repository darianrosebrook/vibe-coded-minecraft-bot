import { Task, TaskParameters, TaskType } from '../../types/task';
import { TaskContext } from '../types';
import { Logger } from '../../utils/observability/logger';
import { TaskParsingLogger } from '../logging/logger';
import { 
  taskTypeHierarchy, 
  validateTaskType, 
  validateSubType,
  getTaskType,
  getSubType
} from './task_types';

// Extend TaskParameters to include description and subType
type ExtendedTaskParameters = TaskParameters & {
  description?: string;
  subType?: string;
};

export class TaskTypeResolver {
  private readonly logger: TaskParsingLogger;

  constructor(logger?: Logger) {
    this.logger = new TaskParsingLogger(logger);
  }

  public async resolve(task: Task, context: TaskContext): Promise<Task> {
    const resolvedTask = await this.detectTaskType(task, context);
    await this.validateTaskParameters(resolvedTask, context);
    return resolvedTask;
  }

  private async detectTaskType(task: Task, context: TaskContext): Promise<Task> {
    // Check for explicit type overrides based on context
    const overriddenType = await this.checkTypeOverrides(task, context);
    if (overriddenType) {
      this.logger.logTypeOverride(task.type, overriddenType);
      return {
        ...task,
        type: overriddenType
      };
    }

    // Validate the detected type using the new validation system
    const typeValidation = validateTaskType(task.type, task.parameters);
    if (!typeValidation.valid) {
      const fallbackType = await this.determineFallbackType(task, context);
      this.logger.logTypeFallback(task.type, fallbackType);
      return {
        ...task,
        type: fallbackType as TaskType
      };
    }

    // Check for sub-type if specified
    const params = task.parameters as ExtendedTaskParameters;
    if (params.subType) {
      const subTypeValidation = validateSubType(task.type, params.subType, task.parameters);
      if (!subTypeValidation.valid) {
        this.logger.logSubTypeValidationFailure(task.type, params.subType, subTypeValidation.errors);
        // Remove invalid sub-type but keep the main type
        const { subType, ...restParams } = params;
        return {
          ...task,
          parameters: restParams
        };
      }
    }

    return task;
  }

  private async checkTypeOverrides(task: Task, context: TaskContext): Promise<TaskType | null> {
    // Check recent tasks for patterns
    const recentTasks = context.recentTasks.slice(-5);
    const params = task.parameters as ExtendedTaskParameters;
    const similarTasks = recentTasks.filter(t => 
      (t.parameters as ExtendedTaskParameters).description?.includes(params.description || '')
    );

    if (similarTasks.length > 0) {
      return similarTasks[0].type as TaskType;
    }

    // Check for specific command patterns using the task type hierarchy
    const command = params.description?.toLowerCase() || '';
    
    for (const [type, typeDef] of Object.entries(taskTypeHierarchy)) {
      if (this.matchesTypePattern(command, typeDef)) {
        return type as TaskType;
      }
    }

    return null;
  }

  private matchesTypePattern(command: string, typeDef: any): boolean {
    // Check if the command matches any of the type's patterns
    const patterns = this.getTypePatterns(typeDef);
    return patterns.some(pattern => command.includes(pattern));
  }

  private getTypePatterns(typeDef: any): string[] {
    const patterns: string[] = [];
    
    // Add base patterns based on type name and description
    patterns.push(typeDef.name.toLowerCase());
    patterns.push(...typeDef.description.toLowerCase().split(' '));
    
    // Add patterns from validation rules
    if (typeDef.validationRules) {
      patterns.push(...typeDef.validationRules.map((rule: string) => 
        rule.replace('hasValid', '').toLowerCase()
      ));
    }
    
    // Add patterns from sub-types
    if (typeDef.subTypes) {
      for (const subType of Object.values(typeDef.subTypes)) {
        patterns.push(...this.getTypePatterns(subType));
      }
    }
    
    return patterns;
  }

  private async validateTaskParameters(task: Task, context: TaskContext): Promise<void> {
    // Get the task type definition
    const taskType = getTaskType(task.type);
    if (!taskType) {
      throw new Error(`Invalid task type: ${task.type}`);
    }

    // Validate parameters using the type's validation rules
    const validation = validateTaskType(task.type, task.parameters);
    if (!validation.valid) {
      throw new Error(`Invalid parameters for ${task.type} task: ${validation.errors.join(', ')}`);
    }

    // If there's a sub-type, validate its parameters
    const params = task.parameters as ExtendedTaskParameters;
    if (params.subType) {
      const subTypeValidation = validateSubType(task.type, params.subType, task.parameters);
      if (!subTypeValidation.valid) {
        throw new Error(`Invalid parameters for ${task.type}.${params.subType} task: ${subTypeValidation.errors.join(', ')}`);
      }
    }
  }

  private async determineFallbackType(task: Task, context: TaskContext): Promise<TaskType> {
    // Try to determine the most likely type based on parameters
    const params = task.parameters as ExtendedTaskParameters;
    for (const [type, typeDef] of Object.entries(taskTypeHierarchy)) {
      if (this.matchesTypePattern(params.description || '', typeDef)) {
        return type as TaskType;
      }
    }

    // Default to inventory if uncertain
    return TaskType.INVENTORY;
  }
} 