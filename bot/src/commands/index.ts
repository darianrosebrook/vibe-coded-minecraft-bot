import { MinecraftBot } from "../bot/bot";
import { parseTask } from "../llm/parse";
import {
  QueryTaskParameters,
  Task,
  MiningTaskParameters,
  FarmingTaskParameters,
  NavigationTaskParameters,
  InventoryTaskParameters,
  TaskType,
  TaskParameters,
} from "@/types/task";
import { BaseTask } from "../tasks/base";
import { NavTask } from "../tasks/nav";
import { ChatTask } from "../tasks/chat";
import { FarmingTask } from '../tasks/farming';
import { InventoryTask } from '../tasks/inventory';
import { QueryTask } from '../tasks/query';
import { GatheringTask } from '../tasks/gathering';
import { GatheringTaskParameters } from '@/types/task';
import logger, { logCommand, logTask, logError } from "@/utils/observability/logger";
import { MiningTask } from "@/tasks/mining";
import { validateCommandParameters, getCommandDefinition } from './registry';

export class CommandHandler {
  private bot: MinecraftBot;
  private activeTasks: Map<string, NodeJS.Timeout> = new Map();
  private taskProgress: Map<string, number> = new Map();
  private taskHandlers: Map<string, BaseTask> = new Map();
  private registeredTasks: Map<string, BaseTask> = new Map();
  private lastMessage: string | undefined = undefined;
  private lastMessageTime: number = 0;
  private readonly DUPLICATE_WINDOW_MS = 5000; // 5 second window

  constructor(bot: MinecraftBot) {
    this.bot = bot;
  }

  public async initialize(): Promise<void> {
    await this.initializeTaskHandlers();
  }

  private async initializeTaskHandlers(): Promise<void> {
    // Register task handlers for each command type
    const chatTask = new ChatTask(this.bot, this, {
      message: '',
      chatType: 'normal',
      context: {
        lastMessage: '',
        playerName: '',
        botState: {
          position: { x: 0, y: 0, z: 0 },
          health: 20,
          food: 20,
          inventory: []
        }
      }
    });
    await chatTask.initialize();
    this.registerTask(TaskType.CHAT, chatTask);

    this.registerTask(TaskType.MINING, new MiningTask(this.bot, this, {
      targetBlock: 'stone',
      quantity: 1,
      maxDistance: 32,
      usePathfinding: true
    }), {
      maxConcurrent: 1,
      timeout: 30000
    });

    this.registerTask(TaskType.NAVIGATION, new NavTask(this.bot, this, {
      location: { x: 0, y: 0, z: 0 },
      mode: 'jump',
      avoidWater: false,
      maxDistance: 32,
      usePathfinding: true
    }), {
      maxConcurrent: 1,
      timeout: 30000
    });

    this.registerTask(TaskType.FARMING, new FarmingTask(this.bot, this, {
      cropType: 'wheat',
      action: 'harvest',
      radius: 32,
      checkInterval: 5000,
      requiresWater: true,
      minWaterBlocks: 4,
      area: {
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 0, z: 0 }
      }
    }), {
      maxConcurrent: 1,
      timeout: 30000
    });

    this.registerTask(TaskType.INVENTORY, new InventoryTask(this.bot, this, {
      operation: 'check',
      itemType: '',
      quantity: 1
    }), {
      maxConcurrent: 1,
      timeout: 30000
    });

    this.registerTask(TaskType.QUERY, new QueryTask(this.bot, this, {
      queryType: 'inventory',
      filters: {}
    }), {
      maxConcurrent: 1,
      timeout: 30000
    });

    this.registerTask(TaskType.GATHERING, new GatheringTask(this.bot, this, {
      resourceType: 'wood',
      quantity: 1,
      radius: 32,
      usePathfinding: true
    }), {
      maxConcurrent: 1,
      timeout: 30000
    });
  }

  public getActiveTasks(): Map<string, NodeJS.Timeout> {
    return this.activeTasks;
  }

  public stopTask(taskId: string): void {
    const taskHandler = this.taskHandlers.get(taskId);
    if (taskHandler) {
      taskHandler.stop();
      this.stopProgressUpdates(taskId);
      this.taskProgress.delete(taskId);
      this.taskHandlers.delete(taskId);
    }
  }

  public stopAllTasks(): void {
    for (const [taskId] of this.activeTasks) {
      this.stopTask(taskId);
    }
  }

  public registerTask(name: string, task: BaseTask, options?: { maxConcurrent?: number; timeout?: number }): void {
    this.registeredTasks.set(name, task);
    if (options) {
      const { maxConcurrent, timeout } = options;
      if (maxConcurrent) {
        this.activeTasks.set(name, setTimeout(() => {
          this.stopTask(name);
        }, timeout));
      }
    }
  }

  public async handleCommand(username: string, message: string): Promise<void> {
    const requestId = logCommand(message, username);

    try {
      // Check for duplicate messages
      if (this.isDuplicateMessage(message)) {
        logger.info('Ignoring duplicate message', { requestId, username, message });
        return;
      }

      // Parse the command into a task
      const task = await parseTask(message, username);
      logTask(task.id, task.type, task.parameters, { requestId });
      
      // Get command definition
      const definition = getCommandDefinition(task.type);
      if (!definition) {
        throw new Error(`No command definition found for type: ${task.type}`);
      }

      // Validate parameters if validation function exists
      if (definition.validate) {
        const isValid = await definition.validate(task.parameters);
        if (!isValid) {
          throw new Error(`Invalid parameters for command: ${definition.name}`);
        }
      }

      // Transform parameters if transform function exists
      let validatedParameters = task.parameters;
      if (definition.transform) {
        validatedParameters = await definition.transform(task.parameters);
        logger.info('Transformed parameters', { 
          requestId,
          original: task.parameters,
          transformed: validatedParameters 
        });
      } else {
        // Use Zod validation as fallback
        const zodValidated = validateCommandParameters(task.type, task.parameters);
        if (!zodValidated) {
          throw new Error(`Invalid parameters for task type: ${task.type}`);
        }
        validatedParameters = zodValidated;
      }

      // Update task with validated parameters
      task.parameters = validatedParameters;

      // Execute the task
      await this.executeTask(task.id, task, username);
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        requestId,
        username,
        message
      });
      await this.handleError(error, username);
    }
  }

  private isDuplicateMessage(message: string): boolean {
    const now = Date.now();
    if (
      this.lastMessage === message &&
      now - this.lastMessageTime < this.DUPLICATE_WINDOW_MS
    ) {
      return true;
    }
    this.lastMessage = message;
    this.lastMessageTime = now;
    return false;
  }

  private startProgressUpdates(taskId: string, username: string): void {
    this.taskProgress.set(taskId, 0);
    
    const progressInterval = setInterval(() => {
      const progress = this.taskProgress.get(taskId) || 0;
      this.bot.getMineflayerBot().chat(`${username}: Task progress: ${progress}%`);
    }, 10000); // Update every 10 seconds
    
    this.activeTasks.set(taskId, progressInterval);
  }

  public stopProgressUpdates(taskId: string): void {
    const interval = this.activeTasks.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.activeTasks.delete(taskId);
    }
  }

  public updateProgress(taskId: string, progress: number): void {
    this.taskProgress.set(taskId, progress);
    
    // Get active task from bot if it's being tracked
    const activeTask = this.bot.getActiveTask();
    if (activeTask && activeTask.name) {
      // Update the ML manager to track this progress for reinforcement learning
      const mlManager = this.bot.getMLManager();
      if (mlManager) {
        // Log progress update for ML data collection if needed
        logger.debug('Task progress update', {
          taskId,
          progress,
          activeTask: activeTask.name
        });
      }
    }
  }

  public getCurrentTaskProgress(): number | null {
    const taskId = Array.from(this.taskProgress.keys()).pop();
    return taskId ? this.taskProgress.get(taskId) || null : null;
  }

  public async executeTask(taskId: string, task: Task, username: string): Promise<void> {
    try {
      // Start progress updates
      this.startProgressUpdates(taskId, username);
      
      // Create a new task instance with the parsed parameters
      let taskHandler: BaseTask;
      switch (task.type) {
        case 'mining':
          taskHandler = new MiningTask(this.bot, this, {
            targetBlock: (task.parameters as MiningTaskParameters).targetBlock,
            quantity: 64,
            maxDistance: 32,
            usePathfinding: true
          });
          break;
        case 'farming':
          taskHandler = new FarmingTask(this.bot, this, {
            cropType: (task.parameters as FarmingTaskParameters).cropType || 'wheat',
            action: 'harvest',
            radius: 32,
            checkInterval: 5000,
            requiresWater: true,
            minWaterBlocks: 4,
            area: {
              start: { x: 0, y: 0, z: 0 },
              end: { x: 0, y: 0, z: 0 }
            }
          });
          break;
        case 'navigation':
          const navParams = task.parameters as NavigationTaskParameters & { x?: number; y?: number; z?: number };
          
          // Normalize coordinates if they're direct properties
          if (!navParams.location && (navParams.x !== undefined || navParams.y !== undefined || navParams.z !== undefined)) {
            navParams.location = {
              x: navParams.x ?? 0,
              y: navParams.y ?? 0,
              z: navParams.z ?? 0
            };
            // Remove the direct coordinate properties
            delete navParams.x;
            delete navParams.y;
            delete navParams.z;
          }
          
          // For navigation tasks, if no location is specified, try to find the player
          if (!navParams.location || (navParams.location.x === 0 && navParams.location.y === 0 && navParams.location.z === 0)) {
            const mineflayerBot = this.bot.getMineflayerBot();
            const players = Object.values(mineflayerBot.entities)
              .filter(entity => entity.type === 'player' && entity.username === username);
            
            if (players.length === 0) {
              this.bot.getMineflayerBot().chat("I can't find you nearby. Please make sure you're close enough.");
              return;
            }
            
            // Use the closest player if multiple are found
            const player = players.reduce((closest, current) => {
              const closestDist = closest.position.distanceTo(mineflayerBot.entity.position);
              const currentDist = current.position.distanceTo(mineflayerBot.entity.position);
              return currentDist < closestDist ? current : closest;
            });
            
            navParams.location = player.position;
          }
          
          const navigationTask = new NavTask(this.bot, this, {
            location: navParams.location,
            mode: 'jump',
            avoidWater: navParams.avoidWater ?? false,
            maxDistance: navParams.maxDistance ?? 32,
            usePathfinding: navParams.usePathfinding ?? true
          });
          taskHandler = navigationTask;
          break;
        case 'inventory':
          taskHandler = new InventoryTask(this.bot, this, {
            operation: (task.parameters as InventoryTaskParameters).operation || 'store',
            itemType: (task.parameters as InventoryTaskParameters).itemType || '',
            quantity: (task.parameters as InventoryTaskParameters).quantity || 1
          });
          break;
        case 'query':
          const queryParams = task.parameters as QueryTaskParameters;
          taskHandler = new QueryTask(this.bot, this, {
            queryType: queryParams.queryType,
            filters: queryParams.filters || {}
          });
          break;
        case 'gathering':
          taskHandler = new GatheringTask(this.bot, this, {
            resourceType: (task.parameters as GatheringTaskParameters).itemType,
            quantity: (task.parameters as GatheringTaskParameters).quantity || 1,
            radius: (task.parameters as GatheringTaskParameters).radius || 32,
            usePathfinding: (task.parameters as GatheringTaskParameters).usePathfinding ?? true
          });
          break;
        case 'crafting':
          const toolManager = this.bot.getToolManager();
          const itemType = (task.parameters as any).itemType;
          const quantity = (task.parameters as any).quantity || 1;
          
          // Try to craft the tool
          const success = await toolManager.ensureTool(itemType, 'wooden');
          if (success) {
            this.bot.getMineflayerBot().chat(`Successfully crafted ${quantity} ${itemType}(s)`);
          } else {
            this.bot.getMineflayerBot().chat(`Failed to craft ${itemType}. I might be missing materials.`);
          }
          return;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      // Store the task handler
      this.taskHandlers.set(taskId, taskHandler);
      
      // Execute the task
      await taskHandler.execute(task, taskId);
      
      // Clean up
      this.stopProgressUpdates(taskId);
      this.taskProgress.delete(taskId);
      this.taskHandlers.delete(taskId);
    } catch (error) {
      this.stopProgressUpdates(taskId);
      this.taskProgress.delete(taskId);
      this.taskHandlers.delete(taskId);
      throw error;
    }
  }

  private async handleError(error: unknown, username: string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Task execution error', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      username
    });
    
    this.bot.getMineflayerBot().chat(`${username}: Error: ${errorMessage}`);
    
    // Implement retry logic here if needed
    // For now, just log the error and notify the user
  }
} 