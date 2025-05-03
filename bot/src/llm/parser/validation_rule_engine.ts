import { Task, TaskType, TaskParameters, MiningTaskParameters, NavigationTaskParameters, CraftingTaskParameters } from '@/types/task';
import { MinecraftBot } from '../../bot/bot';

export interface TaskContext {
  bot: MinecraftBot;
  worldState: {
    inventory: {
      hasTool: (toolType: string) => boolean;
      hasMaterials: (materials: string[]) => boolean;
    };
  };
  currentTask?: Task;
}

export type RuleType = 'REQUIRED' | 'CONDITIONAL' | 'VALIDATION' | 'TRANSFORMATION';

export interface RuleCondition {
  type: string;
  params: Record<string, any>;
  evaluate: (context: TaskContext) => boolean;
}

export interface ValidationRule {
  id: string;
  type: RuleType;
  priority: number;
  conditions: RuleCondition[];
  action: (task: Task, context: TaskContext) => void;
  errorMessage?: string;
}

export class ValidationRuleEngine {
  private rules: Map<string, ValidationRule[]> = new Map();
  private rulePriorities: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules() {
    // Required parameter rules
    this.addRule('mining', {
      id: 'required_tool',
      type: 'REQUIRED',
      priority: 100,
      conditions: [
        {
          type: 'has_tool',
          params: { toolType: 'pickaxe' },
          evaluate: (context) => context.worldState.inventory.hasTool('pickaxe')
        }
      ],
      action: (task) => {
        const miningParams = task.parameters as MiningTaskParameters;
        if (!miningParams.requirements?.tools?.some(tool => tool.type === 'pickaxe')) {
          if (!miningParams.requirements) {
            miningParams.requirements = {};
          }
          if (!miningParams.requirements.tools) {
            miningParams.requirements.tools = [];
          }
          miningParams.requirements.tools.push({
            type: 'pickaxe',
            material: 'diamond',
            required: true
          });
        }
      },
      errorMessage: 'A pickaxe is required for mining tasks'
    });

    // Conditional rules
    this.addRule('crafting', {
      id: 'material_availability',
      type: 'CONDITIONAL',
      priority: 90,
      conditions: [
        {
          type: 'has_materials',
          params: { required: ['planks', 'sticks'] },
          evaluate: (context) => context.worldState.inventory.hasMaterials(['planks', 'sticks'])
        }
      ],
      action: (task) => {
        const craftingParams = task.parameters as unknown as CraftingTaskParameters;
        if (!craftingParams.requirements?.items) {
          if (!craftingParams.requirements) {
            craftingParams.requirements = {};
          }
          craftingParams.requirements.items = [
            { type: 'planks', quantity: 4, required: true },
            { type: 'sticks', quantity: 2, required: true }
          ];
        }
      },
      errorMessage: 'Required materials are not available'
    });

    // Validation rules
    this.addRule('navigation', {
      id: 'valid_destination',
      type: 'VALIDATION',
      priority: 80,
      conditions: [
        {
          type: 'valid_coordinates',
          params: {},
          evaluate: (context) => {
            const navParams = context.currentTask?.parameters as NavigationTaskParameters;
            return navParams?.location && 
              typeof navParams.location.x === 'number' && 
              typeof navParams.location.y === 'number' && 
              typeof navParams.location.z === 'number';
          }
        }
      ],
      action: (task) => {
        const navParams = task.parameters as NavigationTaskParameters;
        if (navParams.location) {
          navParams.location = {
            x: Math.floor(navParams.location.x),
            y: Math.floor(navParams.location.y),
            z: Math.floor(navParams.location.z)
          };
        }
      },
      errorMessage: 'Invalid destination coordinates'
    });
  }

  public addRule(taskType: string, rule: ValidationRule) {
    if (!this.rules.has(taskType)) {
      this.rules.set(taskType, []);
    }
    this.rules.get(taskType)!.push(rule);
    this.rulePriorities.set(rule.id, rule.priority);
  }

  public async validateTask(task: Task, context: TaskContext): Promise<ValidationResult> {
    const taskRules = this.rules.get(task.type) || [];
    const sortedRules = taskRules.sort((a, b) => b.priority - a.priority);
    
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const rule of sortedRules) {
      try {
        const conditionsMet = rule.conditions.every(condition => condition.evaluate(context));
        
        if (conditionsMet) {
          rule.action(task, context);
        } else {
          if (rule.type === 'REQUIRED') {
            errors.push({
              ruleId: rule.id,
              message: rule.errorMessage || 'Required condition not met',
              severity: 'ERROR'
            });
          } else {
            warnings.push({
              ruleId: rule.id,
              message: rule.errorMessage || 'Condition not met',
              severity: 'WARNING'
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        errors.push({
          ruleId: rule.id,
          message: `Error executing rule: ${errorMessage}`,
          severity: 'ERROR'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      task
    };
  }

  public getRulePriorities(): Map<string, number> {
    return new Map(this.rulePriorities);
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  task: Task;
}

export interface ValidationError {
  ruleId: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ValidationWarning extends ValidationError {
  severity: 'WARNING';
} 