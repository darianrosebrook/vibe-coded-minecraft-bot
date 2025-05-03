import { Task, TaskPriority, TaskStatus, TaskType, MiningTaskParameters, CraftingTaskParameters, NavigationTaskParameters } from '@/types/task';
import { GameState } from '../../llm/context/manager';
import { MLStateManager } from '../state/manager';
import { EnhancedResourceNeedPredictor } from '../state/enhanced_predictors';
import { TaskHistory } from '@/types/ml/state';
import { Logger } from '../../utils/observability/logger'; 

export interface TaskOptimizationResult {
  priority: TaskPriority;
  executionPlan: string[];
  estimatedDuration: number;
  confidence: number;
}

export class MLTaskOptimizer {
  private stateManager: MLStateManager;
  private resourcePredictor: EnhancedResourceNeedPredictor;
  private logger: Logger;
  private taskHistory: Map<string, TaskHistory> = new Map();

  constructor(
    stateManager: MLStateManager,
    resourcePredictor: EnhancedResourceNeedPredictor,
    logger?: Logger
  ) {
    this.stateManager = stateManager;
    this.resourcePredictor = resourcePredictor;
    this.logger = logger || new Logger();
  }

  public async optimizeTask(task: Task, gameState: GameState): Promise<TaskOptimizationResult> {
    const startTime = Date.now();

    try {
      // Calculate urgency score
      const urgencyScore = await this.calculateUrgencyScore(task, gameState);

      // Analyze dependencies
      const dependencies = await this.analyzeDependencies(task, gameState);

      // Check resource availability
      const resourceAvailability = await this.checkResourceAvailability(task, gameState);

      // Generate execution plan
      const executionPlan = await this.generateExecutionPlan(task, gameState, dependencies, resourceAvailability);

      // Estimate duration
      const estimatedDuration = await this.estimateDuration(task, gameState, executionPlan);

      // Calculate overall confidence
      const confidence = this.calculateConfidence(urgencyScore, dependencies, resourceAvailability);

      // Determine priority
      const priority = this.determinePriority(urgencyScore, dependencies, resourceAvailability);

      const result: TaskOptimizationResult = {
        priority,
        executionPlan,
        estimatedDuration,
        confidence
      };

      // Record optimization for future learning
      await this.recordOptimization(task, result, Date.now() - startTime);

      return result;
    } catch (error) {
      this.logger.error('Task optimization failed', { taskId: task.id, error });
      throw error;
    }
  }

  private async calculateUrgencyScore(task: Task, gameState: GameState): Promise<number> {
    // Consider task type, dependencies, and current game state
    const baseScore = this.getBaseUrgencyScore(task.type);
    const dependencyScore = await this.calculateDependencyUrgency(task, gameState);
    const stateScore = this.calculateStateUrgency(gameState);

    return (baseScore * 0.4) + (dependencyScore * 0.3) + (stateScore * 0.3);
  }

  private async analyzeDependencies(task: Task, gameState: GameState): Promise<string[]> {
    const dependencies: string[] = [];
    
    // Add resource dependencies based on task type
    if (task.type === TaskType.MINING) {
      const miningParams = task.parameters as MiningTaskParameters;
      if (miningParams.targetBlock) {
        dependencies.push(`block:${miningParams.targetBlock}`);
      }
    } else if (task.type === TaskType.CRAFTING) {
      const craftingParams = task.parameters as unknown as CraftingTaskParameters;
      if (craftingParams.recipe) {
        dependencies.push(`recipe:${craftingParams.recipe}`);
      }
    } else if (task.type === TaskType.NAVIGATION) {
      const navParams = task.parameters as NavigationTaskParameters;
      if (navParams.location) {
        dependencies.push(`location:${JSON.stringify(navParams.location)}`);
      }
    }

    return dependencies;
  }

  private async checkResourceAvailability(task: Task, gameState: GameState): Promise<Map<string, number>> {
    const availability = new Map<string, number>();
    
    // Get current inventory state
    const inventory = gameState.inventory;
    for (const item of inventory.items) {
      availability.set(item.type, item.quantity);
    }
    
    return availability;
  }

  private async generateExecutionPlan(
    task: Task,
    gameState: GameState,
    dependencies: string[],
    resourceAvailability: Map<string, number>
  ): Promise<string[]> {
    const plan: string[] = [];
    
    // Add dependency resolution steps
    for (const dependency of dependencies) {
      plan.push(`resolve:${dependency}`);
    }
    
    // Add main task execution step
    plan.push(`execute:${task.type}`);
    
    return plan;
  }

  private async estimateDuration(task: Task, gameState: GameState, executionPlan: string[]): Promise<number> {
    // Base duration based on task type
    const baseDuration = this.getBaseDuration(task.type);
    
    // Adjust for execution plan complexity
    const complexityFactor = executionPlan.length * 0.1;
    
    // Adjust for current game state
    const stateFactor = this.calculateStateFactor(gameState);
    
    return baseDuration * (1 + complexityFactor) * stateFactor;
  }

  private calculateConfidence(
    urgencyScore: number,
    dependencies: string[],
    resourceAvailability: Map<string, number>
  ): number {
    // Base confidence
    let confidence = 0.7;
    
    // Adjust for urgency
    confidence += urgencyScore * 0.1;
    
    // Adjust for dependencies
    confidence -= dependencies.length * 0.05;
    
    // Adjust for resource availability
    const resourceConfidence = this.calculateResourceConfidence(resourceAvailability);
    confidence += resourceConfidence * 0.2;
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  private determinePriority(
    urgencyScore: number,
    dependencies: string[],
    resourceAvailability: Map<string, number>
  ): TaskPriority {
    // Base priority
    let priority: TaskPriority = TaskPriority.MEDIUM;
    
    // Adjust for urgency
    if (urgencyScore > 0.8) {
      priority = TaskPriority.HIGH;
    } else if (urgencyScore < 0.3) {
      priority = TaskPriority.LOW;
    }
    
    // Adjust for dependencies
    if (dependencies.length > 0) {
      priority = TaskPriority.HIGH;
    }
    
    return priority;
  }

  private async recordOptimization(
    task: Task,
    result: TaskOptimizationResult,
    optimizationTime: number
  ): Promise<void> {
    const history: TaskHistory = {
      taskId: task.id,
      success: true,
      startTime: Date.now(),
      endTime: Date.now(),
      resourcesUsed: {}, 
      type: task.type,
      status: TaskStatus.COMPLETED
    };
    
    this.taskHistory.set(task.id, history);
  }

  private getBaseUrgencyScore(taskType: TaskType): number {
    const urgencyScores: Record<TaskType, number> = {
      [TaskType.MINING]: 0.7,
      [TaskType.CRAFTING]: 0.6,
      [TaskType.NAVIGATION]: 0.5,
      [TaskType.GATHERING]: 0.6,
      [TaskType.FARMING]: 0.5,
      [TaskType.COMBAT]: 0.8,
      [TaskType.HEALING]: 0.9,
      [TaskType.QUERY]: 0.3,
      [TaskType.INVENTORY]: 0.4,
      [TaskType.INTERACTION]: 0.5,
      [TaskType.CHAT]: 0.3,
      [TaskType.UNKNOWN]: 0.5
    };
    
    return urgencyScores[taskType] || 0.5;
  }

  private async calculateDependencyUrgency(task: Task, gameState: GameState): Promise<number> {
    const dependencies = await this.analyzeDependencies(task, gameState);
    return dependencies.length > 0 ? 0.8 : 0.2;
  }

  private calculateStateUrgency(gameState: GameState): number {
    // Consider various game state factors
    let urgency = 0.5;
    
    // Adjust for time of day
    if (gameState.timeOfDay < 13000 || gameState.timeOfDay > 23000) {
      urgency -= 0.2;
    } else {
      urgency += 0.2;
    }
    
    // Adjust for health
    if (gameState.health < 10) {
      urgency += 0.3;
    }
    
    return Math.min(Math.max(urgency, 0), 1);
  }

  private calculateResourceConfidence(resourceAvailability: Map<string, number>): number {
    if (resourceAvailability.size === 0) return 0.5;
    
    const totalItems = Array.from(resourceAvailability.values()).reduce((sum, count) => sum + count, 0);
    const averageAvailability = totalItems / resourceAvailability.size;
    
    return Math.min(averageAvailability / 64, 1); // Normalize to stack size
  }

  private getBaseDuration(taskType: TaskType): number {
    const baseDurations: Record<TaskType, number> = {
      [TaskType.MINING]: 5000,
      [TaskType.CRAFTING]: 3000,
      [TaskType.NAVIGATION]: 8000,
      [TaskType.GATHERING]: 4000,
      [TaskType.FARMING]: 6000,
      [TaskType.COMBAT]: 10000,
      [TaskType.HEALING]: 2000,
      [TaskType.QUERY]: 1000,
      [TaskType.INVENTORY]: 2000,
      [TaskType.INTERACTION]: 3000,
      [TaskType.CHAT]: 1000,
      [TaskType.UNKNOWN]: 5000
    };
    
    return baseDurations[taskType] || 5000;
  }

  private calculateStateFactor(gameState: GameState): number {
    let factor = 1.0;
    
    // Adjust for time of day
    if (gameState.timeOfDay < 13000 || gameState.timeOfDay > 23000) {
      factor *= 1.2; // Tasks take 20% longer at night
    }
    
    // Adjust for health
    if (gameState.health < 10) {
      factor *= 1.3; // Tasks take 30% longer when health is low
    }
    
    return factor;
  }
} 