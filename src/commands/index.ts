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
} from "@/types";
import { BaseTask } from "../tasks/base";
import { NavTask } from "../tasks/nav";
import { ChatTask } from "../tasks/chat";
import { FarmingTask } from '../tasks/farming';
import { InventoryTask } from '../tasks/inventory';
import { QueryTask } from '../tasks/query';
import { GatheringTask } from '../tasks/gathering';
import { GatheringTaskParameters } from '@/types/task';

interface BotState {
  position: { x: number; y: number; z: number };
  health: number;
  food: number;
  inventory: Array<{ name: string; count: number; slot: number; type: string }>;
  blockAtFeet: { name: string } | null;
  blockAtHead: { name: string } | null;
  timeOfDay: number;
  isDay: boolean;
  isRaining: boolean;
  biome: string;
  nearbyEntities: Array<{
    type: string;
    name: string;
    distance: number;
    position: { x: number; y: number; z: number };
    isHostile: boolean;
    isPassive: boolean;
  }>;
  equipment: {
    mainHand: string | null;
    offHand: string | null;
    armor: {
      helmet: string | null;
      chestplate: string | null;
      leggings: string | null;
      boots: string | null;
    };
  };
  experience: {
    level: number;
    points: number;
    progress: number;
  };
  environment: {
    blockAtFeet: string;
    blockAtHead: string;
    lightLevel: number;
    isInWater: boolean;
    onGround: boolean;
  };
  movement: {
    velocity: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
    control: {
      sprint: boolean;
      sneak: boolean;
    };
  };
}

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

  public registerTask(name: string, task: BaseTask): void {
    this.registeredTasks.set(name, task);
  }

  public async handleCommand(username: string, message: string): Promise<void> {
    if (username === this.bot.getMineflayerBot().username) return;

    if (message.startsWith('.bot ')) {
      const command = message.slice(5);
      
      // Handle stop command specially
      if (command.toLowerCase() === 'stop') {
        this.stopAllTasks();
        this.bot.getMineflayerBot().chat(`${username}: All tasks have been stopped.`);
        return;
      }
      
      const taskId = `${username}-${Date.now()}`;
      
      // Prevent duplicate processing of the same command within a time window
      const now = Date.now();
      if (this.lastMessage === command && (now - this.lastMessageTime) < this.DUPLICATE_WINDOW_MS) {
        return;
      }
      
      this.lastMessage = command;
      this.lastMessageTime = now;
      
      logger.info('Processing command', {
        username,
        command,
        taskId
      });

      // Get bot's current state for context
      const mineflayerBot = this.bot.getMineflayerBot();
      logger.info('Gathering bot state', {
        position: mineflayerBot.entity.position,
        health: mineflayerBot.health,
        food: mineflayerBot.food
      });

      const botState = {
        position: mineflayerBot.entity.position,
        health: mineflayerBot.health,
        food: mineflayerBot.food,
        inventory: mineflayerBot.inventory.items().map(item => ({
          name: item.name,
          count: item.count,
          slot: item.slot,
          type: item.type.toString()
        })),
        biome: (await mineflayerBot.world.getBiome(mineflayerBot.entity.position)).toString(),
        isRaining: mineflayerBot.isRaining,
        timeOfDay: mineflayerBot.time.timeOfDay,
        isDay: mineflayerBot.time.isDay,
        nearbyEntities: Object.values(mineflayerBot.entities)
          .filter((e: any) => {
            if (e === mineflayerBot.entity) return false;
            const distance = Math.sqrt(
              Math.pow(e.position.x - mineflayerBot.entity.position.x, 2) +
              Math.pow(e.position.y - mineflayerBot.entity.position.y, 2) +
              Math.pow(e.position.z - mineflayerBot.entity.position.z, 2)
            );
            // Increase range for players and include all player entities
            if (e.type === 'player') return distance < 64;
            return distance < 32;
          })
          .map((e: any) => ({
            type: e.type,
            name: e.username || e.name || e.type,
            distance: Math.floor(Math.sqrt(
              Math.pow(e.position.x - mineflayerBot.entity.position.x, 2) +
              Math.pow(e.position.y - mineflayerBot.entity.position.y, 2) +
              Math.pow(e.position.z - mineflayerBot.entity.position.z, 2)
            )),
            position: e.position,
            isHostile: e.isHostile || false,
            isPassive: e.isPassive || false
          })),
        equipment: {
          mainHand: mineflayerBot.heldItem?.name || 'empty',
          offHand: mineflayerBot.inventory.slots[45]?.name || 'empty',
          armor: {
            helmet: mineflayerBot.inventory.slots[5]?.name || 'empty',
            chestplate: mineflayerBot.inventory.slots[6]?.name || 'empty',
            leggings: mineflayerBot.inventory.slots[7]?.name || 'empty',
            boots: mineflayerBot.inventory.slots[8]?.name || 'empty'
          }
        },
        experience: {
          level: mineflayerBot.experience.level,
          points: mineflayerBot.experience.points,
          progress: mineflayerBot.experience.progress
        },
        environment: {
          blockAtFeet: mineflayerBot.blockAt(mineflayerBot.entity.position)?.name || 'unknown',
          blockAtHead: mineflayerBot.blockAt(mineflayerBot.entity.position.offset(0, 1, 0))?.name || 'unknown',
          lightLevel: mineflayerBot.world.getBlockLight(mineflayerBot.entity.position),
          isInWater: !mineflayerBot.entity.onGround,
          onGround: mineflayerBot.entity.onGround
        },
        movement: {
          velocity: mineflayerBot.entity.velocity,
          yaw: mineflayerBot.entity.yaw,
          pitch: mineflayerBot.entity.pitch,
          control: {
            sprint: mineflayerBot.controlState.sprint,
            sneak: mineflayerBot.controlState.sneak
          }
        }
      };

      try {
        const task = await parseTask(command, username);
        logger.info('Parsed task', {
          taskId,
          taskType: task.type,
          parameters: task.parameters
        });

        // Only create a chat task if the parsed task is of type 'chat'
        if (task.type === TaskType.CHAT) {
          const chatTask = new ChatTask(this.bot, this, {
            message: command,
            context: {
              botState,
              playerName: username
            }
          });
          logger.info('Created chat task', {
            taskId,
            command,
            botState: {
              position: botState.position,
              health: botState.health,
              nearbyEntities: botState.nearbyEntities.length
            }
          });
          await chatTask.execute(null, taskId);
        } else {
          await this.executeTask(taskId, task, username);
          logger.info('Task executed', {
            taskId,
            taskType: task.type
          });
        }
      } catch (error) {
        logger.error('Task execution failed', {
          taskId,
          command,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        await this.handleError(error, username);
      }
      return;
    }
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
            itemType: (task.parameters as InventoryTaskParameters).itemType,
            quantity: (task.parameters as InventoryTaskParameters).quantity || 1
          });
          break;
        case 'query':
          const queryParams = task.parameters as QueryTaskParameters;
          taskHandler = new QueryTask(this.bot, this, {
            queryType: queryParams.queryType,
            filters: queryParams.filters
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
    console.error('Task execution error:', error);
    
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    this.bot.getMineflayerBot().chat(`${username}: Error: ${errorMessage}`);
    
    // Implement retry logic here if needed
    // For now, just log the error and notify the user
  }
} 