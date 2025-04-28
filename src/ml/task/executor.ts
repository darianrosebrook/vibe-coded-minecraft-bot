import { Task, TaskResult, TaskStatus, TaskType } from '../../types/task';
import { MLTaskOptimizer } from './optimizer';
import { MLStateManager } from '../state/manager';
import { TaskHistory } from '../state/types';
import { Logger } from '../../utils/observability/logger';
import { metrics } from '../../utils/observability/metrics';
import { EnhancedGameState } from '../state/types';

export class MLTaskExecutor {
  private optimizer: MLTaskOptimizer;
  private stateManager: MLStateManager;
  private logger: Logger;
  private taskHistory: Map<string, TaskHistory> = new Map();

  constructor(
    optimizer: MLTaskOptimizer,
    stateManager: MLStateManager,
    logger?: Logger
  ) {
    this.optimizer = optimizer;
    this.stateManager = stateManager;
    this.logger = logger || new Logger();
  }

  public async executeTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    this.logger.info('Starting ML task execution', { taskId: task.id, taskType: task.type });

    try {
      // Get current game state
      const gameState = await this.stateManager.getState();
      const convertedGameState = this.stateManager.convertToGameState(gameState);

      // Optimize task execution
      const optimizationResult = await this.optimizer.optimizeTask(task, convertedGameState);

      // Update task with optimization results
      task.priority = optimizationResult.priority;
      task.metadata = {
        ...task.metadata,
        executionPlan: optimizationResult.executionPlan,
        estimatedDuration: optimizationResult.estimatedDuration,
        confidence: optimizationResult.confidence
      };

      // Execute the optimized plan
      await this.executeOptimizedPlan(task, optimizationResult.executionPlan);

      // Record successful execution
      const duration = Date.now() - startTime;
      this.recordTaskExecution(task, true);

      metrics.tasksCompleted.inc({ task_type: task.type });
      metrics.taskDuration.observe({ task_type: task.type }, duration);

      return {
        success: true,
        task,
        duration,
        data: {
          executionPlan: optimizationResult.executionPlan,
          confidence: optimizationResult.confidence
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordTaskExecution(task, false);

      metrics.tasksFailed.inc({ 
        task_type: task.type,
        error_type: error instanceof Error ? error.message : 'unknown'
      });

      this.logger.error('ML task execution failed', { 
        taskId: task.id, 
        error,
        duration 
      });

      return {
        success: false,
        task,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          executionPlan: task.metadata?.executionPlan || [],
          confidence: task.metadata?.confidence || 0
        }
      };
    }
  }

  private async executeOptimizedPlan(task: Task, executionPlan: string[]): Promise<void> {
    // If execution plan is empty, consider it a valid case and return
    if (executionPlan.length === 0) {
      return;
    }

    for (const step of executionPlan) {
      const [action, ...params] = step.split(':');
      
      switch (action) {
        case 'resolve':
          await this.executeDependencyResolution(params[0]);
          break;
        case 'execute':
          await this.executeMainTask(task);
          break;
        case 'gather':
        case 'move':
          // These are handled as part of the main task execution
          break;
        default:
          throw new Error(`Unknown execution step: ${action}`);
      }
    }
  }

  private async executeDependencyResolution(dependency: string): Promise<void> {
    const [type, value] = dependency.split(':');
    
    switch (type) {
      case 'block':
        await this.resolveBlockDependency(value);
        break;
      case 'recipe':
        await this.resolveRecipeDependency(value);
        break;
      case 'location':
        await this.resolveLocationDependency(JSON.parse(value));
        break;
      default:
        throw new Error(`Unknown dependency type: ${type}`);
    }
  }

  private async resolveBlockDependency(blockType: string): Promise<void> {
    // TODO: Implement block dependency resolution
    this.logger.info('Resolving block dependency', { blockType });
  }

  private async resolveRecipeDependency(recipeName: string): Promise<void> {
    // TODO: Implement recipe dependency resolution
    this.logger.info('Resolving recipe dependency', { recipeName });
  }

  private async resolveLocationDependency(location: { x: number; y: number; z: number }): Promise<void> {
    // TODO: Implement location dependency resolution
    this.logger.info('Resolving location dependency', { location });
  }

  private async executeMainTask(task: Task): Promise<void> {
    const gameState = await this.stateManager.getState();
    
    switch (task.type) {
      case TaskType.MINING:
        await this.executeMiningTask(task, gameState);
        break;
      case TaskType.CRAFTING:
        await this.executeCraftingTask(task, gameState);
        break;
      case TaskType.NAVIGATION:
        await this.executeNavigationTask(task, gameState);
        break;
      case TaskType.GATHERING:
        await this.executeGatheringTask(task, gameState);
        break;
      case TaskType.FARMING:
        await this.executeFarmingTask(task, gameState);
        break;
      case TaskType.COMBAT:
        await this.executeCombatTask(task, gameState);
        break;
      case TaskType.HEALING:
        await this.executeHealingTask(task, gameState);
        break;
      case TaskType.QUERY:
        await this.executeQueryTask(task, gameState);
        break;
      case TaskType.INVENTORY:
        await this.executeInventoryTask(task, gameState);
        break;
      case TaskType.INTERACTION:
        await this.executeInteractionTask(task, gameState);
        break;
      case TaskType.CHAT:
        await this.executeChatTask(task, gameState);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async executeMiningTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing mining task', { taskId: task.id });
  }

  private async executeCraftingTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing crafting task', { taskId: task.id });
  }

  private async executeNavigationTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing navigation task', { taskId: task.id });
  }

  private async executeGatheringTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing gathering task', { taskId: task.id });
  }

  private async executeFarmingTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing farming task', { taskId: task.id });
  }

  private async executeCombatTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing combat task', { taskId: task.id });
  }

  private async executeHealingTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing healing task', { taskId: task.id });
  }

  private async executeQueryTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing query task', { taskId: task.id });
  }

  private async executeInventoryTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing inventory task', { taskId: task.id });
  }

  private async executeInteractionTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing interaction task', { taskId: task.id });
  }

  private async executeChatTask(task: Task, gameState: any): Promise<void> {
    this.logger.info('Executing chat task', { taskId: task.id });
  }

  private recordTaskExecution(
    task: Task,
    success: boolean,
  ): void {
    const history: TaskHistory = {
      taskId: task.id,
      taskType: task.type,
      success,  
      startTime: Date.now() - 1,
      endTime: Date.now(),
      resourcesUsed: new Map(),
      executionTime: 1
    };
    
    this.taskHistory.set(task.id, history);
  }

  public getTaskHistory(taskId: string): TaskHistory | undefined {
    return this.taskHistory.get(taskId);
  }

  public getAllTaskHistory(): TaskHistory[] {
    return Array.from(this.taskHistory.values());
  }
} 