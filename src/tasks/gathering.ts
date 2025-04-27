import { MinecraftBot } from '../bot/bot';
import { Task, TaskParameters, TaskResult, GatheringTaskParameters } from '../types/task';
import { BaseTask, TaskOptions } from './base';
import { Bot as MineflayerBot } from 'mineflayer';
import { goals } from 'mineflayer-pathfinder';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Block } from 'prismarine-block';
import { CommandHandler } from '../commands';

export class GatheringTask extends BaseTask {
  private itemType: string;
  private quantity: number;
  private maxDistance: number;
  private usePathfinding: boolean;
  private gatheredCount: number = 0;
  protected mineflayerBot: MineflayerBot;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: GatheringTaskParameters) {
    super(bot, commandHandler, options);
    this.mineflayerBot = bot.getMineflayerBot();
    this.itemType = options.itemType;
    this.quantity = options.quantity;
    this.maxDistance = options.maxDistance || 32;
    this.usePathfinding = options.usePathfinding ?? true;
  }

  public async performTask(): Promise<void> {
    logger.info('Starting gathering task', {
      itemType: this.itemType,
      quantity: this.quantity,
      maxDistance: this.maxDistance
    });

    try {
      // Find blocks of the specified type within maxDistance
      const blocks = this.mineflayerBot.findBlocks({
        matching: (block) => block.name === this.itemType,
        maxDistance: this.maxDistance,
        count: this.quantity
      });

      if (blocks.length === 0) {
        throw new Error(`No ${this.itemType} blocks found within ${this.maxDistance} blocks`);
      }

      this.setProgressSteps(blocks.length);

      // Gather each block
      for (const block of blocks) {
        if (this.gatheredCount >= this.quantity) {
          break;
        }

        try {
          // Navigate to the block if pathfinding is enabled
          if (this.usePathfinding) {
            const goal = new goals.GoalBlock(block.x, block.y, block.z);
            await this.mineflayerBot.pathfinder.goto(goal);
          }

          // Dig the block
          const targetBlock = this.mineflayerBot.blockAt(block);
          if (!targetBlock) {
            throw new Error('Block not found');
          }

          await this.mineflayerBot.dig(targetBlock);
          this.gatheredCount++;

          // Update progress
          await this.updateProgress(this.gatheredCount);
          metrics.tasksCompleted.inc({ task_type: 'gathering' });

          // Small delay between blocks
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.warn('Failed to gather block', {
            block: block,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with next block
        }
      }

      if (this.gatheredCount < this.quantity) {
        throw new Error(`Only gathered ${this.gatheredCount} out of ${this.quantity} ${this.itemType}`);
      }

      await this.updateProgress(100);
    } catch (error) {
      await this.handleError(error as Error, {
        category: 'BLOCK_INTERACTION',
        severity: 'HIGH',
        taskId: this.taskId!,
        taskType: 'gathering',
        metadata: {
          itemType: this.itemType,
          quantity: this.quantity,
          gatheredCount: this.gatheredCount
        }
      });
      if (!this.shouldRetry()) {
        throw error;
      }
      await this.retry();
    }
  }
} 