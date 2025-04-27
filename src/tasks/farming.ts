import { BaseTask, TaskOptions } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters } from '../types/task';
import logger from '../utils/observability/logger';
import { metrics } from '../utils';
import { goals } from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';

export type FarmingTaskParameters = TaskOptions & {
  cropType: 'wheat' | 'carrots' | 'potatoes' | 'beetroot';
  action: 'harvest' | 'plant' | 'replant';
  quantity?: number;
  radius?: number;
  checkInterval?: number;
  requiresWater?: boolean;
  minWaterBlocks?: number;
};

export type FarmingTaskOptions = FarmingTaskParameters & TaskOptions;

export class FarmingTask extends BaseTask {
  private cropType: string;
  private action: string;
  private quantity: number;
  private radius: number;
  private checkInterval: number;
  private requiresWater: boolean;
  private minWaterBlocks: number;
  private cropsProcessed: number = 0;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: FarmingTaskParameters) {
    super(bot, commandHandler, options);
    this.cropType = options.cropType;
    this.action = options.action;
    this.quantity = options.quantity || 64;
    this.radius = options.radius || 32;
    this.checkInterval = options.checkInterval || 5000;
    this.requiresWater = options.requiresWater ?? false;
    this.minWaterBlocks = options.minWaterBlocks || 4;
  }

  public async performTask(): Promise<void> {
    logger.info('Starting farming task', {
      cropType: this.cropType,
      action: this.action,
      quantity: this.quantity,
    });

    const bot = this.bot.getMineflayerBot();
    const center = bot.entity.position;

    // Find all crop blocks within radius
    const blocks = bot.findBlocks({
      matching: (block) => {
        if (this.action === 'harvest') {
          return block.name === this.cropType && block.metadata === 7; // Fully grown
        }
        return block.name === 'farmland';
      },
      maxDistance: this.radius,
      count: this.quantity,
    });

    if (blocks.length === 0) {
      throw new Error(`No ${this.action === 'harvest' ? 'grown crops' : 'farmland'} found within ${this.radius} blocks`);
    }

    this.setProgressSteps(blocks.length);

    for (const block of blocks) {
      if (this.cropsProcessed >= this.quantity) {
        break;
      }

      try {
        if (this.action === 'harvest') {
          const targetBlock = bot.blockAt(block);
          if (!targetBlock) throw new Error('Block not found');
          await bot.dig(targetBlock);
          this.cropsProcessed++;
        } else if (this.action === 'plant' || this.action === 'replant') {
          const seed = bot.inventory.items().find(item => 
            item.name === `${this.cropType}_seeds` || 
            item.name === this.cropType
          );
          
          if (seed) {
            await bot.equip(seed, 'hand');
            const targetBlock = bot.blockAt(block);
            if (!targetBlock) throw new Error('Block not found');
            await bot.placeBlock(targetBlock, new Vec3(0, 1, 0));
            this.cropsProcessed++;
          } else {
            throw new Error(`No ${this.cropType} seeds found in inventory`);
          }
        }

        await this.updateProgress(this.cropsProcessed);
        metrics.tasksCompleted.inc({ 
          task_type: 'farming'
        });

        // Check for water if required
        if (this.requiresWater) {
          const waterBlocks = bot.findBlocks({
            matching: (block) => block.name === 'water',
            maxDistance: 4,
            count: this.minWaterBlocks,
          });
          
          if (waterBlocks.length < this.minWaterBlocks) {
            throw new Error(`Not enough water blocks nearby (found ${waterBlocks.length}, need ${this.minWaterBlocks})`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      } catch (error) {
        await this.handleError(error as Error, {
          category: 'BLOCK_INTERACTION',
          severity: 'HIGH',
          taskId: this.taskId!,
          taskType: 'farming',
          location: block,
          metadata: { 
            cropType: this.cropType,
            action: this.action 
          },
        });
        if (!this.shouldRetry()) {
          throw error;
        }
        await this.retry();
      }
    }

    logger.info('Farming task completed', {
      cropsProcessed: this.cropsProcessed,
      cropType: this.cropType,
      action: this.action,
    });
  }
} 