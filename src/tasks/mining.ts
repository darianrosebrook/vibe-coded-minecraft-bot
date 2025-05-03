import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters, MiningTaskParameters, TaskResult, TaskType, TaskStatus } from '@/types/task';
import { BaseTask, TaskOptions } from './base';
import { goals } from 'mineflayer-pathfinder';
import logger from '../utils/observability/logger';
import { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
import { MiningMLState } from '@/ml/state/miningState';
import { MiningOptimizer } from '@/ml/reinforcement/miningOptimizer';
import { CentralizedDataCollector } from '../ml/state/centralized_data_collector';
import { TaskStorage } from '../storage/taskStorage';
import { MLStateManager } from '../ml/state/manager';
import { WorldTracker } from '../bot/worldTracking';
import { TrainingDataStorage } from '../ml/state/training_data_storage';
import { IDataCollector } from '@/types/ml/interfaces';

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
  protected override dataCollector!: IDataCollector;
  protected override storage!: TaskStorage;
  protected override trainingStorage!: TrainingDataStorage;
  protected override startTime: number = 0;
  protected override retryCount: number = 0;
  protected override isStopped: boolean = false;
  protected override progress: number = 0;
  protected override radius: number = 10;
  protected depth: number = 5;
  protected override worldTracker!: WorldTracker;

  constructor(
    bot: MinecraftBot,
    commandHandler: CommandHandler,
    options: ExtendedMiningTaskParameters,
    dataCollector?: IDataCollector
  ) {
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

    // Initialize data collection
    this.dataCollector = dataCollector || bot.getMLManager().getDataCollector();
    this.storage = new TaskStorage('mining_data');
    this.trainingStorage = new TrainingDataStorage();
    this.worldTracker = new WorldTracker(bot);
  }

  protected async getTaskSpecificState(): Promise<MiningMLState> {
    return {
      currentPosition: this.mineflayerBot.entity.position,
      targetResource: this.targetBlock,
      targetDepth: this.yLevel,
      discoveredDeposits: this.discoveredBlocks.map(b => ({
        type: b.type,
        position: b.position,
        size: 1,
        density: 1,
        depth: this.yLevel,
        hardness: 1,
        timestamp: Date.now()
      })),
      currentTool: {
        type: 'pickaxe',
        efficiency: 1.0,
        durability: 1.0,
        enchantments: []
      },
      currentPath: {
        waypoints: [],
        distance: 0,
        efficiency: 0,
        safety: 1.0,
        resourceYield: {
          resource: 1,
          quantity: this.quantity,
          efficiency: 1.0,
          safety: 1.0,
          timestamp: Date.now()
        },
      },
      performance: {
        miningEfficiency: this.calculateMiningEfficiency(),
        resourceDiscoveryRate: this.discoveredBlocks.length,
        toolDurability: 1.0
      }
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
      // Update the world tracker with the mined block
      const biome = this.getWorldTracker().getBiomeAt(block.position);
      if (biome) {
        // The block will be automatically removed from resource locations
        // when the world tracker detects the block change
        this.getWorldTracker().clearCaches(); // Clear caches to ensure fresh data
      }

      await this.mineflayerBot.dig(block);
      this.minedCount++;
      return true;
    } catch (error) {
      logger.error(`Failed to mine block at ${block.position}:`, error);
      return false;
    }
  }

  private async discoverBlocks(): Promise<void> {
    // Use WorldTracker to find known resource locations first
    const knownLocations = this.getWorldTracker().getResourceLocations(this.targetBlock);
    if (knownLocations.length > 0) {
      logger.info(`Found ${knownLocations.length} known locations for ${this.targetBlock}`);
      for (const position of knownLocations) {
        this.discoveredBlocks.push({
          type: this.targetBlock,
          position,
          quantity: 1 // We'll update this when we actually mine it
        });
      }
    }

    // If we need more blocks, scan the area
    if (this.discoveredBlocks.length < this.quantity) {
      const botPosition = this.mineflayerBot.entity.position;
      const startX = Math.floor(botPosition.x - this.radius);
      const startZ = Math.floor(botPosition.z - this.radius);
      const endX = Math.floor(botPosition.x + this.radius);
      const endZ = Math.floor(botPosition.z + this.radius);

      for (let x = startX; x <= endX; x++) {
        for (let z = startZ; z <= endZ; z++) {
          for (let y = this.yLevel - this.depth; y <= this.yLevel; y++) {
            const position = new Vec3(x, y, z);
            const block = this.mineflayerBot.world.getBlock(position);

            if (block && block.name === this.targetBlock) {
              // Check if this block is in a known biome for this resource
              const biome = this.getWorldTracker().getBiomeAt(position);
              if (biome && this.getWorldTracker().getKnownBlocks(biome).includes(this.targetBlock)) {
                this.discoveredBlocks.push({
                  type: block.name,
                  position,
                  quantity: 1
                });
              }
            }
          }
        }
      }
    }
  }

  public override async updateMLState(): Promise<void> {
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

  public override async navigateTo(position: Vec3): Promise<void> {
    // Use WorldTracker to find the best path considering known resources
    const nearestResource = await this.getWorldTracker().findResource(this.targetBlock);
    if (nearestResource && nearestResource.distanceTo(position) < this.maxDistance) {
      position = nearestResource;
    }

    if (this.usePathfinding) {
      const goal = new goals.GoalBlock(position.x, position.y, position.z);
      await this.mineflayerBot.pathfinder.goto(goal);
    } else {
      await this.mineflayerBot.lookAt(position);
      const goal = new goals.GoalBlock(position.x, position.y, position.z);
      await this.mineflayerBot.pathfinder.goto(goal);
    }
  }

  public override async ensureTool(): Promise<void> {
    const toolManager = this.bot.getToolManager();
    await toolManager.ensureTool('pickaxe', this.targetBlock);
  }

  public override async execute(task: Task | null, taskId: string): Promise<TaskResult> {
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
        duration: Date.now() - this.startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  public override async validateTask(): Promise<void> {
    await super.validateTask();

    if (!this.targetBlock) {
      throw new Error('Target block is required');
    }

    if (this.quantity && this.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
  }

  public override async initializeProgress(): Promise<void> {
    await super.initializeProgress();
    this.minedCount = 0;
    this.discoveredBlocks = [];
  }

  public override async performTask(): Promise<void> {
    this.startTime = Date.now();
    await this.initializeMLState();
    await this.ensureTool();

    while (!this.isStopped) {
      await this.discoverBlocks();

      for (const block of this.discoveredBlocks) {
        if (this.isStopped) break;

        await this.navigateTo(block.position);
        const blockToMine = this.mineflayerBot.blockAt(block.position);
        if (!blockToMine) {
          continue;
        }
        const success = await this.mineBlock(blockToMine);

        if (!success) {
          this.retryCount++;
          if (this.retryCount > this.maxRetries) {
            throw new Error('Failed to mine block after multiple attempts');
          }
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
          continue;
        }

        await this.updateProgress((this.minedCount / this.quantity) * 100);
        await this.updateMLState();
      }
    }
  }

  public override async updateProgress(progress: number): Promise<void> {
    this.progress = Math.min(1, Math.max(0, progress));
  }

  public override shouldRetry(): boolean {
    return this.retryCount < (this.options.maxRetries || 3);
  }

  public override async retry(): Promise<void> {
    this.retryCount++;
    await this.initializeProgress();
    await this.performTask();
  }

  public override stop(): void {
    this.isStopped = true;
    this.dataCollector.stop();
  }

  protected override async handleError(error: Error, metadata: Record<string, any>): Promise<void> {
    await super.handleError(error, {
      ...metadata,
    });
  }

  protected shouldStop(): boolean {
    return this.isStopped || this.minedCount >= this.quantity;
  }
} 