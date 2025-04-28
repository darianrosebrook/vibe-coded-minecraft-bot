import { BaseTask, TaskOptions } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters, FarmingTaskParameters, TaskResult, TaskType, TaskStatus } from '@/types/task';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Bot as MineflayerBot } from 'mineflayer';
import pathfinder from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import { FarmingOptimizer } from '../ml/reinforcement/farmingOptimizer';
import { FarmingMLState } from '../ml/state/farmingState';
import { CentralizedDataCollector } from '../ml/state/centralized_data_collector';
import { TaskStorage } from '../storage/taskStorage';
import { MLStateManager } from '../ml/state/manager';
import { WorldTracker } from '../ml/world/tracker';
import { TrainingDataStorage } from '../ml/state/training_data_storage';

export class FarmingTask extends BaseTask {
  protected readonly bot: MinecraftBot;
  protected readonly commandHandler: CommandHandler;
  protected readonly options: FarmingTaskParameters;
  protected readonly stateManager: MLStateManager;
  protected readonly worldTracker: WorldTracker;
  protected cropType: 'wheat' | 'carrots' | 'potatoes' | 'beetroot';
  protected area: { start: Vec3; end: Vec3 };
  protected waterSources: Vec3[];
  protected checkInterval: number;
  protected usePathfinding: boolean;
  protected avoidWater: boolean;
  protected mineflayerBot: MineflayerBot;
  protected stopRequested: boolean = false;
  protected cropsProcessed: number = 0;
  protected optimizer: FarmingOptimizer;
  protected farmingState: FarmingMLState | null = null;
  protected cropStates: Array<{ position: Vec3; growth: number; lastHarvest: number }> = [];
  protected dataCollector: CentralizedDataCollector;
  protected storage: TaskStorage;
  protected trainingStorage: TrainingDataStorage;
  protected useML: boolean;
  protected startTime: number = 0;
  protected retryCount: number = 0;
  protected isStopped: boolean = false;
  protected progress: number = 0;
  protected radius: number = 10;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: FarmingTaskParameters) {
    super(bot, commandHandler, {
      ...options,
      useML: options.useML ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      timeout: options.timeout ?? 70000
    });
    this.bot = bot;
    this.commandHandler = commandHandler;
    this.options = options;
    this.stateManager = new MLStateManager(bot);
    this.worldTracker = new WorldTracker(bot);
    
    this.mineflayerBot = bot.getMineflayerBot();
    this.mineflayerBot.loadPlugin(pathfinder.pathfinder);
    
    this.cropType = options.cropType;
    this.area = {
      start: new Vec3(options.area.start.x, options.area.start.y, options.area.start.z),
      end: new Vec3(options.area.end.x, options.area.end.y, options.area.end.z)
    };
    this.waterSources = [];
    this.checkInterval = options.checkInterval || 1000;
    this.usePathfinding = options.usePathfinding ?? true;
    this.avoidWater = options.avoidWater ?? false;
    this.useML = options.useML ?? true;
    
    this.optimizer = new FarmingOptimizer();
    this.initializeMLState();
    
    // Initialize data collection
    this.dataCollector = new CentralizedDataCollector(this.mineflayerBot);
    this.storage = new TaskStorage('farming_data');
    this.trainingStorage = new TrainingDataStorage();
    this.dataCollector.start();
  }

  private initializeMLState(): void {
    this.farmingState = {
      cropDistribution: {
        type: this.cropType,
        positions: [],
        growth: [],
        efficiency: 0
      },
      waterCoverage: {
        sources: this.waterSources,
        coverage: 0,
        efficiency: 0
      },
      farmingPath: {
        waypoints: [],
        distance: 0,
        efficiency: 0
      },
      performance: {
        farmingEfficiency: 0,
        harvestRate: 0,
        growthRate: 0
      }
    };
  }

  private async updateMLState(): Promise<void> {
    if (this.options.useML) {
      const currentState = await this.getCurrentState();
      await this.collectTrainingData({
        type: 'farming_state',
        state: currentState,
        metadata: {
          biome: this.mineflayerBot.world.getBiome(this.mineflayerBot.entity.position),
          position: this.mineflayerBot.entity.position
        }
      });
    }

    if (!this.farmingState) return;

    // Update crop distribution
    this.farmingState.cropDistribution = {
      type: this.cropType,
      positions: this.cropStates.map(c => c.position),
      growth: this.cropStates.map(c => c.growth),
      efficiency: this.calculateCropEfficiency()
    };

    // Update water coverage
    this.farmingState.waterCoverage = {
      sources: this.waterSources,
      coverage: this.calculateWaterCoverage(),
      efficiency: this.calculateWaterEfficiency()
    };

    // Update farming path
    this.farmingState.farmingPath = {
      waypoints: this.generateFarmingGrid(),
      distance: this.calculatePathDistance(),
      efficiency: this.calculatePathEfficiency()
    };

    // Update performance metrics
    this.farmingState.performance = {
      farmingEfficiency: this.calculateFarmingEfficiency(),
      harvestRate: this.calculateHarvestRate(),
      growthRate: this.calculateGrowthRate()
    };

    await this.optimizer.updateState(this.farmingState);
  }

  private calculateCropEfficiency(): number {
    const totalCrops = this.cropStates.length;
    const matureCrops = this.cropStates.filter(c => c.growth === 7).length;
    return (matureCrops / totalCrops) * 100;
  }

  private calculateWaterCoverage(): number {
    const totalArea = (this.area.end.x - this.area.start.x + 1) * 
                     (this.area.end.z - this.area.start.z + 1);
    const waterArea = this.waterSources.length * 9; // Each water source covers 9 blocks
    return (waterArea / totalArea) * 100;
  }

  private calculateWaterEfficiency(): number {
    const coverage = this.calculateWaterCoverage();
    return coverage >= 100 ? 100 : coverage;
  }

  private calculatePathDistance(): number {
    if (!this.farmingState?.farmingPath.waypoints.length) return 0;
    
    let distance = 0;
    for (let i = 1; i < this.farmingState.farmingPath.waypoints.length; i++) {
      const prev = this.farmingState.farmingPath.waypoints[i - 1];
      const current = this.farmingState.farmingPath.waypoints[i];
      distance += prev.distanceTo(current);
    }
    return distance;
  }

  private calculatePathEfficiency(): number {
    const distance = this.calculatePathDistance();
    const optimalDistance = (this.area.end.x - this.area.start.x) * 
                          (this.area.end.z - this.area.start.z);
    return (optimalDistance / distance) * 100;
  }

  private calculateFarmingEfficiency(): number {
    const timeElapsed = Date.now() - this.startTime;
    const cropsPerSecond = this.cropsProcessed / (timeElapsed / 1000);
    const maxEfficiency = 1.0; // Theoretical maximum crops per second
    return this.calculateEfficiency('farming', cropsPerSecond, maxEfficiency);
  }

  private calculateHarvestRate(): number {
    const timeElapsed = Date.now() - this.startTime;
    return (this.cropsProcessed / timeElapsed) * 1000; // Crops per second
  }

  private calculateGrowthRate(): number {
    const totalGrowth = this.cropStates.reduce((sum, crop) => sum + crop.growth, 0);
    const timeElapsed = Date.now() - this.startTime;
    return (totalGrowth / timeElapsed) * 1000; // Growth per second
  }

  private generateFarmingGrid(): Vec3[] {
    const waypoints: Vec3[] = [];
    
    for (let x = this.area.start.x; x <= this.area.end.x; x++) {
      for (let z = this.area.start.z; z <= this.area.end.z; z++) {
        waypoints.push(new Vec3(x, this.area.start.y, z));
      }
    }
    
    return waypoints;
  }

  private async navigateTo(position: Vec3): Promise<void> {
    if (this.usePathfinding) {
      const goal = new pathfinder.goals.GoalBlock(position.x, position.y, position.z);
      const movements = this.mineflayerBot.pathfinder.movements;
      
      if (this.avoidWater) {
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

  private async ensureTools(): Promise<void> {
    const toolManager = this.bot.getToolManager();
    await toolManager.ensureTool('hoe', this.cropType);
  }

  private async checkWaterSources(): Promise<void> {
    const waterBlocks = this.mineflayerBot.findBlocks({
      matching: block => block.name === 'water',
      maxDistance: 16,
      count: 100
    });

    this.waterSources = waterBlocks;
  }

  private async harvestAndReplant(block: any): Promise<boolean> {
    try {
      await this.mineflayerBot.dig(block);
      await this.mineflayerBot.placeBlock(block, this.cropType);
      this.cropsProcessed++;
      await this.updateMLState();
      return true;
    } catch (error) {
      logger.error('Failed to harvest and replant', { error });
      return false;
    }
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
          type: TaskType.FARMING,
          parameters: this.options,
          priority: 50,
          status: TaskStatus.COMPLETED,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        task: {
          id: taskId,
          type: TaskType.FARMING,
          parameters: this.options,
          priority: 50,
          status: TaskStatus.FAILED,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async validateTask(): Promise<void> {
    if (!this.cropType) {
      throw new Error('Crop type is required');
    }
    
    if (!this.area || !this.area.start || !this.area.end) {
      throw new Error('Farming area is required');
    }
  }

  async initializeProgress(): Promise<void> {
    this.startTime = Date.now();
    this.cropsProcessed = 0;
    this.cropStates = [];
    await this.checkWaterSources();
  }

  async performTask(): Promise<void> {
    await this.initializeMLState();
    await this.ensureTools();
    
    while (!this.isStopped) {
      await this.checkWaterSources();
      
      for (const waypoint of this.generateFarmingGrid()) {
        if (this.isStopped) break;
        
        await this.navigateTo(waypoint);
        const block = this.mineflayerBot.blockAt(waypoint);
        
        if (block && block.name === this.cropType) {
          const success = await this.harvestAndReplant(block);
          if (success) {
            this.cropsProcessed++;
            await this.updateProgress((this.cropsProcessed / this.quantity) * 100);
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, this.checkInterval));
    }
  }

  protected async getCurrentState(): Promise<FarmingMLState> {
    return {
      cropDistribution: {
        type: this.cropType,
        positions: this.cropStates.map(c => c.position),
        growth: this.cropStates.map(c => c.growth),
        efficiency: this.calculateCropEfficiency()
      },
      waterCoverage: {
        sources: this.waterSources,
        coverage: this.calculateWaterCoverage(),
        efficiency: this.calculateWaterEfficiency()
      },
      farmingPath: {
        waypoints: this.generateFarmingGrid(),
        distance: this.calculatePathDistance(),
        efficiency: this.calculatePathEfficiency()
      },
      performance: {
        farmingEfficiency: this.calculateFarmingEfficiency(),
        harvestRate: this.calculateHarvestRate(),
        growthRate: this.calculateGrowthRate()
      }
    };
  }

  async updateProgress(progress: number): Promise<void> {
    // Update progress
  }

  shouldRetry(): boolean {
    return false;
  }

  async retry(): Promise<void> {
    // Retry logic
  }

  stop(): void {
    this.isStopped = true;
  }
} 