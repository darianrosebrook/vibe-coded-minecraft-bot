import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters, MiningTaskParameters, TaskResult, TaskType, TaskStatus } from '../types/task';
import { BaseTask, TaskOptions } from './base';
import { Bot as MineflayerBot } from 'mineflayer';
import { goals } from 'mineflayer-pathfinder';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
import { MiningOptimizer } from '@/ml/reinforcement/miningOptimizer';
import { MiningMLState } from '@/ml/state/miningState';
import { CentralizedDataCollector } from '../ml/state/centralized_data_collector';
import { TaskStorage } from '../storage/taskStorage';
import { MLStateManager } from '../ml/state/manager';
import { WorldTracker } from '../bot/worldTracking';
import { TrainingDataStorage } from '../ml/state/training_data_storage';

// Extend MiningTaskParameters to include ML-related options
interface ExtendedMiningTaskParameters extends MiningTaskParameters {
  useML?: boolean;
  avoidWater?: boolean;
}

export class MiningTask extends BaseTask {
  protected targetBlock: string;
  protected quantity: number;
  protected maxDistance: number;
  protected yLevel: number;
  protected usePathfinding: boolean;
  protected minedCount: number = 0;
  protected optimizer: MiningOptimizer;
  protected miningState: MiningMLState | null = null;
  protected discoveredBlocks: Array<{ type: string; position: Vec3; quantity: number }> = [];
  protected dataCollector: CentralizedDataCollector;
  protected storage: TaskStorage;
  protected trainingStorage: TrainingDataStorage;
  protected startTime: number = 0;
  protected retryCount: number = 0;
  protected isStopped: boolean = false;
  protected progress: number = 0;
  protected radius: number = 10;
  protected depth: number = 5;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: ExtendedMiningTaskParameters) {
    super(bot, commandHandler, {
      ...options,
      useML: options.useML ?? true, // Enable ML by default for mining
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      timeout: options.timeout ?? 70000
    });
    
    this.targetBlock = options.targetBlock;
    this.quantity = options.quantity || 1;
    this.maxDistance = options.maxDistance || 10;
    this.yLevel = options.yLevel || 0;
    this.usePathfinding = options.usePathfinding ?? true;
    this.radius = this.maxDistance;
    
    this.optimizer = new MiningOptimizer();
    this.mineflayerBot.loadPlugin(pathfinder.pathfinder);
    
    // Initialize data collection
    this.dataCollector = new CentralizedDataCollector(this.mineflayerBot);
    this.storage = new TaskStorage('mining_data');
    this.trainingStorage = new TrainingDataStorage();
    this.dataCollector.start();
  }

  protected async getTaskSpecificState(): Promise<MiningMLState> {
    return {
      position: this.mineflayerBot.entity.position,
      targetBlock: this.targetBlock,
      minedCount: this.minedCount,
      discoveredBlocks: this.discoveredBlocks,
      inventory: this.mineflayerBot.inventory.items().map(item => ({
        name: item.name,
        count: item.count
      })),
      efficiency: this.calculateMiningEfficiency()
    };
  }

  private calculateMiningEfficiency(): number {
    const timeElapsed = Date.now() - this.startTime;
    const blocksPerSecond = this.minedCount / (timeElapsed / 1000);
    const maxEfficiency = 2.0; // Theoretical maximum blocks per second
    return this.calculateEfficiency('mining', blocksPerSecond, maxEfficiency);
  }

  private async mineBlock(block: Block): Promise<boolean> {
    try {
      await this.mineflayerBot.dig(block);
      this.minedCount++;
      await this.updateMLState();
      return true;
    } catch (error) {
      logger.error('Failed to mine block', { error });
      return false;
    }
  }

  private async discoverBlocks(): Promise<void> {
    const blocks = this.mineflayerBot.findBlocks({
      matching: block => block.name === this.targetBlock,
      maxDistance: this.maxDistance,
      count: 100
    });

    for (const block of blocks) {
      const existingBlock = this.discoveredBlocks.find(b => 
        b.position.equals(block)
      );
      
      if (!existingBlock) {
        this.discoveredBlocks.push({
          type: this.targetBlock,
          position: block,
          quantity: 1
        });
      }
    }
  }

  private async updateMLState(): Promise<void> {
    if (this.options.useML) {
      const currentState = await this.getTaskSpecificState();
      await this.collectTrainingData({
        type: 'mining_state',
        state: currentState,
        metadata: {
          biome: this.mineflayerBot.world.getBiome(this.mineflayerBot.entity.position),
          position: this.mineflayerBot.entity.position
        }
      });
    }
  }

  private async navigateTo(position: Vec3): Promise<void> {
    if (this.usePathfinding) {
      const goal = new pathfinder.goals.GoalBlock(position.x, position.y, position.z);
      const movements = this.mineflayerBot.pathfinder.movements;
      
      if (this.options.avoidWater) {
        movements.allowSprinting = true;
        movements.allowParkour = true;
      }
      
      await this.mineflayerBot.pathfinder.goto(goal);
    } else {
      await this.mineflayerBot.lookAt(position);
      await this.mineflayerBot.setControlState('forward', true);
      
      while (this.mineflayerBot.entity.position.distanceTo(position) > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await this.mineflayerBot.setControlState('forward', false);
    }
  }

  private async ensureTool(): Promise<void> {
    const toolManager = this.bot.getToolManager();
    await toolManager.ensureTool('pickaxe', this.targetBlock);
  }

  async execute(task: Task | null, taskId: string): Promise<TaskResult> {
    try {
      await this.validateTask();
      await this.initializeProgress();
      await this.performTask();
      
      return {
        success: true,
        task: {
          id: taskId,
          type: TaskType.MINING,
          parameters: this.options,
          priority: 50,
          status: TaskStatus.COMPLETED,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        duration: Date.now() - this.startTime
      };
    } catch (error) {
      return {
        success: false,
        task: {
          id: taskId,
          type: TaskType.MINING,
          parameters: this.options,
          priority: 50,
          status: TaskStatus.FAILED,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - this.startTime
      };
    }
  }

  async validateTask(): Promise<void> {
    await super.validateTask();
    
    if (!this.targetBlock) {
      throw new Error('Target block is required');
    }
    
    if (this.quantity && this.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
  }

  async initializeProgress(): Promise<void> {
    await super.initializeProgress();
    this.minedCount = 0;
    this.discoveredBlocks = [];
  }

  async performTask(): Promise<void> {
    this.startTime = Date.now();
    await this.initializeMLState();
    await this.ensureTool();
    
    while (!this.isStopped) {
      await this.discoverBlocks();
      
      for (const block of this.discoveredBlocks) {
        if (this.isStopped) break;
        
        await this.navigateTo(block.position);
        const success = await this.mineBlock(this.mineflayerBot.blockAt(block.position));
        
        if (!success) {
          this.retryCount++;
          if (this.retryCount > this.maxRetries) {
            throw new Error('Failed to mine block after multiple attempts');
          }
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }
        
        await this.updateProgress((this.minedCount / this.quantity) * 100);
        await this.updateMLState();
      }
    }
  }

  async updateProgress(progress: number): Promise<void> {
    this.progress = Math.min(1, Math.max(0, progress));
  }

  shouldRetry(): boolean {
    return this.retryCount < (this.options.retry?.maxAttempts || 3);
  }

  async retry(): Promise<void> {
    this.retryCount++;
    await this.initializeProgress();
    await this.performTask();
  }

  stop(): void {
    this.isStopped = true;
    this.dataCollector.stop();
  }

  protected async handleError(error: Error, metadata: Record<string, any>): Promise<void> {
    await super.handleError(error, {
      ...metadata,
      targetBlock: this.targetBlock,
      minedCount: this.minedCount,
      discoveredBlocks: this.discoveredBlocks.length
    });
  }

  protected shouldStop(): boolean {
    return this.isStopped || this.minedCount >= this.quantity;
  }
} 