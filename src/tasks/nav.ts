import { BaseTask, TaskOptions } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters } from '../types/task';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Bot as MineflayerBot } from 'mineflayer';
import pathfinder from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';

export type NavigationTaskParameters = TaskOptions & {
  location: {
    x: number;
    y: number;
    z: number;
  };
  mode?: 'walk' | 'sprint' | 'jump';
  avoidWater?: boolean;
  maxDistance?: number;
  usePathfinding?: boolean;
};

export class NavigationTask extends BaseTask {
  private location: { x: number; y: number; z: number };
  private mode: 'walk' | 'sprint' | 'jump';
  private avoidWater: boolean;
  private usePathfinding: boolean;
  private maxDistance: number;
  protected mineflayerBot: MineflayerBot;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: NavigationTaskParameters) {
    super(bot, commandHandler, options);
    this.location = options.location;
    this.mode = options.mode ?? 'walk';
    this.avoidWater = options.avoidWater ?? false;
    this.usePathfinding = options.usePathfinding ?? true;
    this.maxDistance = options.maxDistance ?? 32;
    this.mineflayerBot = bot.getMineflayerBot();
    this.mineflayerBot.loadPlugin(pathfinder.pathfinder);
  }

  public async performTask(): Promise<void> {
    if (!this.location) {
      throw new Error('Location is required for navigation task');
    }
    logger.info('Starting navigation task', {
      location: this.location,
      mode: this.mode
    });

    try {
      const { x, y, z } = this.location;
      const goal = new pathfinder.goals.GoalBlock(x, y, z);
      
      // Configure pathfinder
      if (this.usePathfinding) {
        const movements = this.mineflayerBot.pathfinder.movements;
        
        // Configure movements based on mode
        if (this.mode === 'jump') {
          movements.allowSprinting = true;
          movements.allowParkour = true;
          movements.allow1by1towers = true;
          movements.allowFreeMotion = true;
          movements.canDig = true;
          movements.allowEntityDetection = true;
        }
        
        await this.mineflayerBot.pathfinder.goto(goal);
      } else {
        // Simple movement without pathfinding
        await this.mineflayerBot.lookAt(new Vec3(x, y, z));
        await this.mineflayerBot.setControlState('forward', true);
        
        // Wait until we're close enough
        while (this.mineflayerBot.entity.position.distanceTo(new Vec3(x, y, z)) > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        await this.mineflayerBot.setControlState('forward', false);
      }

      await this.updateProgress(100);
      metrics.tasksCompleted.inc({ task_type: 'navigation' });
    } catch (error) {
      await this.handleError(error as Error, {
        category: 'PATHFINDING',
        severity: 'HIGH',
        taskId: this.taskId!,
        taskType: 'navigation',
        location: this.location,
        metadata: { 
          usePathfinding: this.usePathfinding 
        },
      });
      if (!this.shouldRetry()) {
        throw error;
      }
      await this.retry();
    }
  }
} 