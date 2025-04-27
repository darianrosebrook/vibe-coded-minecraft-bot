import { MinecraftBot } from '../bot/bot';
import { Task, TaskParameters } from '../types/task';
import { Bot as MineflayerBot } from 'mineflayer';
import pathfinder from 'mineflayer-pathfinder';
import { BaseTask, TaskOptions } from './base';
import { CommandHandler } from '../commands';
import { Vec3 } from 'vec3';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';

export interface ExplorationTaskParameters {
  resourceType?: string;
  biomeName?: string;
  radius?: number;
  spacing?: number;
  avoidWater?: boolean;
  usePathfinding?: boolean;
}

export type ExplorationTaskOptions = ExplorationTaskParameters & TaskOptions;

export class ExplorationTask extends BaseTask {
  private targetResource: string | null = null;
  private targetBiome: string | null = null;
  private radius: number;
  private spacing: number;
  private avoidWater: boolean;
  private usePathfinding: boolean;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: ExplorationTaskOptions) {
    super(bot, commandHandler, options);
    this.mineflayerBot = bot.getMineflayerBot();
    this.mineflayerBot.loadPlugin(pathfinder.pathfinder);
    
    this.targetResource = options.resourceType || null;
    this.targetBiome = options.biomeName || null;
    this.radius = options.radius || 100;
    this.spacing = options.spacing || 8;
    this.avoidWater = options.avoidWater ?? false;
    this.usePathfinding = options.usePathfinding ?? true;
  }

  public async validateTask(): Promise<void> {
    if (!this.targetResource && !this.targetBiome) {
      throw new Error('Either resourceType or biomeName must be specified');
    }
  }

  public async initializeProgress(): Promise<void> {
    this.setProgressSteps(1);
    await this.updateProgress(0);
  }

  public async performTask(): Promise<void> {
    logger.info('Starting exploration task', {
      targetResource: this.targetResource,
      targetBiome: this.targetBiome,
      radius: this.radius
    });

    try {
      if (this.targetResource) {
        await this.exploreForResource();
      } else if (this.targetBiome) {
        await this.exploreForBiome();
      }

      await this.updateProgress(100);
      metrics.tasksCompleted.inc({ task_type: 'exploration' });
    } catch (error) {
      await this.handleError(error as Error, {
        category: 'PATHFINDING',
        severity: 'HIGH',
        taskId: this.taskId!,
        taskType: 'exploration',
        metadata: {
          targetResource: this.targetResource,
          targetBiome: this.targetBiome,
          radius: this.radius
        }
      });
      if (!this.shouldRetry()) {
        throw error;
      }
      await this.retry();
    }
  }

  private async exploreForResource(): Promise<void> {
    const botPosition = this.mineflayerBot.entity.position;
    const points = this.generateExplorationGrid(botPosition);

    for (const point of points) {
      const block = this.mineflayerBot.blockAt(point);
      if (block && block.name === this.targetResource) {
        await this.navigateTo(point);
        return;
      }
    }

    throw new Error(`Resource ${this.targetResource} not found within radius ${this.radius}`);
  }

  private async exploreForBiome(): Promise<void> {
    const botPosition = this.mineflayerBot.entity.position;
    const points = this.generateExplorationGrid(botPosition);

    for (const point of points) {
      const biome = this.mineflayerBot.world.getBiome(point);
      if (biome && biome.toString() === this.targetBiome) {
        await this.navigateTo(point);
        return;
      }
    }

    throw new Error(`Biome ${this.targetBiome} not found within radius ${this.radius}`);
  }

  private generateExplorationGrid(center: Vec3): Vec3[] {
    const points: Vec3[] = [];
    const step = this.spacing;

    for (let x = -this.radius; x <= this.radius; x += step) {
      for (let z = -this.radius; z <= this.radius; z += step) {
        points.push(center.offset(x, 0, z));
      }
    }

    return points.sort((a, b) => {
      const distA = a.distanceTo(center);
      const distB = b.distanceTo(center);
      return distA - distB;
    });
  }

  private async navigateTo(destination: Vec3): Promise<void> {
    const goal = new pathfinder.goals.GoalBlock(destination.x, destination.y, destination.z);
    
    try {
      if (this.usePathfinding) {
        const movements = this.mineflayerBot.pathfinder.movements;
        if (this.avoidWater) {
          movements.allowSprinting = true;
          movements.allowParkour = true;
        }
        await this.mineflayerBot.pathfinder.goto(goal);
      } else {
        await this.mineflayerBot.lookAt(destination);
        await this.mineflayerBot.setControlState('forward', true);
        
        while (this.mineflayerBot.entity.position.distanceTo(destination) > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        await this.mineflayerBot.setControlState('forward', false);
      }
    } catch (error) {
      throw new Error(`Failed to navigate to ${destination}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 