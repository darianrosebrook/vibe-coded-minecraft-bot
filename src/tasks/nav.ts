import { BaseTask, TaskOptions } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters, NavigationTaskParameters, TaskResult, TaskType, TaskStatus } from '@/types/task';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Bot as MineflayerBot } from 'mineflayer';
import pathfinder from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import { Entity } from 'prismarine-entity';
import { NavOptimizer } from '@/ml/reinforcement/navOptimizer';
import { NavMLState } from '@/ml/state/navState';

export class NavTask extends BaseTask {
  protected destination: Vec3;
  protected avoidWater: boolean;
  protected usePathfinding: boolean;
  protected maxDistance: number;
  protected pathLength: number = 0;
  protected obstaclesEncountered: number = 0;
  protected optimizer: NavOptimizer;
  protected navState: NavMLState | null = null;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: NavigationTaskParameters) {
    super(bot, commandHandler, {
      ...options,
      useML: options.useML ?? true, // Enable ML by default for navigation
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      timeout: options.timeout ?? 60000
    });
    
    this.mineflayerBot.loadPlugin(pathfinder.pathfinder);
    
    this.destination = new Vec3(
      options.location.x,
      options.location.y,
      options.location.z
    );
    this.avoidWater = options.avoidWater ?? true;
    this.usePathfinding = options.usePathfinding ?? true;
    this.maxDistance = options.maxDistance ?? Infinity;
    
    this.optimizer = new NavOptimizer();
  }

  protected async getCurrentState(): Promise<NavMLState> {
    const currentPos = this.mineflayerBot.entity.position;
    const distance = currentPos.distanceTo(this.destination);
    
    return {
      currentPosition: currentPos,
      destination: this.destination,
      distance,
      pathLength: this.pathLength,
      obstacles: this.obstaclesEncountered,
      timeElapsed: Date.now() - this.startTime,
      efficiency: this.calculatePathEfficiency(),
      biome: this.mineflayerBot.world.getBiome(currentPos),
      avoidWater: this.avoidWater,
      timestamp: Date.now()
    };
  }

  protected calculatePathEfficiency(): number {
    const currentPos = this.mineflayerBot.entity.position;
    const directDistance = currentPos.distanceTo(this.destination);
    return (directDistance / this.pathLength) * 100;
  }

  protected async navigateToDestination(): Promise<boolean> {
    try {
      if (this.usePathfinding) {
        const goal = new pathfinder.goals.GoalBlock(
          this.destination.x,
          this.destination.y,
          this.destination.z
        );
        
        const movements = this.mineflayerBot.pathfinder.movements;
        if (this.avoidWater) {
          movements.allowSprinting = true;
          movements.allowParkour = true;
        }
        
        await this.mineflayerBot.pathfinder.goto(goal);
        this.pathLength = this.mineflayerBot.entity.position.distanceTo(this.destination);
        return true;
      } else {
        // Simple movement without pathfinding
        await this.mineflayerBot.lookAt(this.destination);
        await this.mineflayerBot.setControlState('forward', true);
        
        while (this.mineflayerBot.entity.position.distanceTo(this.destination) > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        await this.mineflayerBot.setControlState('forward', false);
        return true;
      }
    } catch (error) {
      logger.error('Navigation failed', { error, destination: this.destination });
      this.obstaclesEncountered++;
      return false;
    }
  }

  async performTask(): Promise<void> {
    this.startTime = Date.now();
    await this.initializeMLState();
    
    while (!this.stopRequested) {
      const success = await this.navigateToDestination();
      if (!success) {
        this.retryCount++;
        if (this.retryCount > this.maxRetries) {
          throw new Error('Failed to navigate after multiple attempts');
        }
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        continue;
      }
      
      const distance = this.mineflayerBot.entity.position.distanceTo(this.destination);
      await this.updateProgress(1 - (distance / this.maxDistance));
      
      if (distance < 1) {
        break;
      }
      
      await this.updateMLState();
    }
  }

  protected async handleError(error: Error, metadata: Record<string, any>): Promise<void> {
    await super.handleError(error, {
      ...metadata,
      destination: this.destination,
      pathLength: this.pathLength,
      obstacles: this.obstaclesEncountered
    });
  }

  stop(): void {
    this.stopRequested = true;
  }
} 