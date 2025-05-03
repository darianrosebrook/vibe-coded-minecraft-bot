import { BaseTask, TaskOptions } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters, QueryTaskParameters, TaskResult, TaskType, TaskStatus } from '@/types/task';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics'; 
import { Vec3 } from 'vec3';

interface QueryMLState {
  queryState: {
    queryType: string;
    target: string | Vec3 | undefined;
    radius: number;
    results: number;
    efficiency: number;
  };
  biome: {
    name: string;
    position: Vec3;
  };
}

export class QueryTask extends BaseTask {
  protected queryType: 'inventory' | 'block' | 'entity' | 'biome' | 'time' | 'position';
  protected target?: string | Vec3 | undefined;
  protected override  radius: number;
  protected results: any[] = [];
  protected mlState: QueryMLState | null = null;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: QueryTaskParameters) {
    super(bot, commandHandler, {
      ...options,
      useML: options.useML ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      timeout: options.timeout ?? 70000
    });
    this.queryType = options.queryType;
    this.target = options.filters?.blockType;
    this.radius = options.filters?.radius || 16;
  }

  protected async getTaskSpecificState(): Promise<QueryMLState> {
    const currentPos = this.mineflayerBot.entity.position;
    return {
      queryState: {
        queryType: this.queryType,
        target: this.target,
        radius: this.radius,
        results: this.results.length,
        efficiency: this.calculateQueryEfficiency()
      },
      biome: {
        name: this.bot.getBiomeAt(currentPos) || 'unknown',
        position: currentPos
      }
    };
  }

  private calculateQueryEfficiency(): number {
    if (this.startTime === 0) return 0;
    const timeElapsed = Date.now() - this.startTime;
    return this.results.length / (timeElapsed / 1000);
  }

  private async queryBlocks(): Promise<boolean> {
    try {
      if (!this.target || typeof this.target === 'string') {
        throw new Error('Block query requires Vec3 target');
      }

      const blocks = this.mineflayerBot.findBlocks({
        matching: (block) => true,
        maxDistance: this.radius,
        count: 1000,
        point: this.target
      });

      this.results = blocks.map(block => ({
        position: block,
        type: this.mineflayerBot.blockAt(block)?.name
      }));

      return true;
    } catch (error) {
      logger.error('Failed to query blocks', { error });
      return false;
    }
  }

  private async queryEntities(): Promise<boolean> {
    try {
      const entities = Object.values(this.mineflayerBot.entities)
        .filter(entity => {
          if (!this.target) return true;
          if (typeof this.target === 'string') {
            return entity.name === this.target;
          }
          return entity.position.distanceTo(this.target) <= this.radius;
        });

      this.results = entities.map(entity => ({
        id: entity.id,
        name: entity.name,
        position: entity.position,
        type: entity.type
      }));

      return true;
    } catch (error) {
      logger.error('Failed to query entities', { error });
      return false;
    }
  }

  private async queryInventory(): Promise<boolean> {
    try {
      const inventory = this.mineflayerBot.inventory;
      const items = inventory.items();

      this.results = items.map(item => ({
        name: item.name,
        count: item.count,
        slot: item.slot
      }));

      return true;
    } catch (error) {
      logger.error('Failed to query inventory', { error });
      return false;
    }
  }

  private async queryPosition(): Promise<boolean> {
    try {
      const position = this.mineflayerBot.entity.position;
      const biome = this.bot.getBiomeAt(position) || 'unknown';
      this.results = [{
        x: Math.floor(position.x),
        y: Math.floor(position.y),
        z: Math.floor(position.z),
        biome
      }];
      
      // Format the response
      const result = this.results[0];
      this.bot.chat(`I am at coordinates (${result.x}, ${result.y}, ${result.z}) in the ${result.biome} biome.`);
      return true;
    } catch (error) {
      logger.error('Failed to query position', { error });
      return false;
    }
  }

  override async validateTask(): Promise<void> {
    await super.validateTask();

    if (!this.queryType) {
      throw new Error('Query type is required');
    }

    if (this.queryType === 'block' && !this.target) {
      throw new Error('Target is required for block query');
    }
  }

  override async initializeProgress(): Promise<void> {
    await super.initializeProgress();
    this.results = [];
  }

  override async performTask(): Promise<void> {
    await this.initializeMLState();

    let success = false;
    switch (this.queryType) {
      case 'block':
        success = await this.queryBlocks();
        break;
      case 'entity':
        success = await this.queryEntities();
        break;
      case 'inventory':
        success = await this.queryInventory();
        break;
      case 'position':
        success = await this.queryPosition();
        break;
      default:
        throw new Error(`Unsupported query type: ${this.queryType}`);
    }

    if (!success) {
      this.retryCount++;
      if (this.retryCount > this.maxRetries) {
        throw new Error(`Failed to perform ${this.queryType} query after multiple attempts`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.performTask();
    }

    await this.updateProgress(100);
  }
} 