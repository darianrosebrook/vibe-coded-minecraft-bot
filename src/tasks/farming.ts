import { BaseTask, TaskOptions } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters, FarmingTaskParameters, TaskResult, TaskType, TaskStatus } from '@/types/task';
import { FarmingMLState } from '@/types/ml/farming';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Bot as MineflayerBot } from 'mineflayer';
import pathfinder from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3'; 
import { CentralizedDataCollector } from '../ml/state/centralized_data_collector';
import { TaskStorage } from '../storage/taskStorage';
import { MLStateManager } from '../ml/state/manager'; 
import { TrainingDataStorage } from '../ml/state/training_data_storage';
import { WorldTracker } from '@/bot/worldTracking';
import { FarmingOptimizer } from '@/ml/optimization/farming_optimizer';

export class FarmingTask extends BaseTask {
  protected override readonly bot: MinecraftBot;
  protected override readonly commandHandler: CommandHandler;
  protected override readonly options: FarmingTaskParameters;
  protected override readonly stateManager: MLStateManager;
  protected override readonly worldTracker: WorldTracker;
  protected cropType: 'wheat' | 'carrots' | 'potatoes' | 'beetroot';
  protected area: { start: Vec3; end: Vec3 };
  protected waterSources: Vec3[];
  protected checkInterval: number;
  protected usePathfinding: boolean;
  protected avoidWater: boolean;
  protected override mineflayerBot: MineflayerBot;
  protected override stopRequested: boolean = false;
  protected cropsProcessed: number = 0;
  protected optimizer: FarmingOptimizer;
  protected farmingState: FarmingMLState | null = null;
  protected cropStates: Array<{ position: Vec3; growth: number; lastHarvest: number }> = [];
  protected override dataCollector: CentralizedDataCollector;
  protected override storage: TaskStorage;
  protected override trainingStorage: TrainingDataStorage;
  protected override useML: boolean;
  protected override startTime: number = 0;
  protected override retryCount: number = 0;
  protected override isStopped: boolean = false;
  protected override progress: number = 0;
  protected override radius: number = 10;
  protected quantity: number = 0;

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
    this.quantity = options.quantity ?? 64; // Default to 64 if not specified
    
    this.optimizer = new FarmingOptimizer();
    this.initializeMLState();
    
    // Initialize data collection objects
    this.dataCollector = new CentralizedDataCollector(this.mineflayerBot);
    this.storage = new TaskStorage('farming_data');
    this.trainingStorage = new TrainingDataStorage();
  }

  public override async initialize(): Promise<void> {
    await super.initialize();
    
    // Wait for bot to be initialized
    await new Promise<void>((resolve) => {
      const checkBot = () => {
        if (this.mineflayerBot) {
          resolve();
        } else {
          setTimeout(checkBot, 100);
        }
      };
      checkBot();
    });

    // Load pathfinder plugin
    this.mineflayerBot.loadPlugin(pathfinder.pathfinder);

    // Initialize and start data collector
    await this.dataCollector.initialize();
    this.dataCollector.start();
  }

  protected override async initializeMLState(): Promise<void> {
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
      },
      farms: {},
      predictions: {
        yields: [],
        optimizations: []
      },
      farmingSkillLevel: 0,
      timestamp: Date.now()
    };
  }

  protected async getTaskSpecificState(): Promise<any> {
    return {
      cropType: this.cropType,
      area: this.area,
      waterSources: this.waterSources,
      cropsProcessed: this.cropsProcessed,
      farmingState: this.farmingState
    };
  }

  protected override async updateMLState(): Promise<void> {
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
    const waypoints = this.farmingState.farmingPath.waypoints;
    
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1];
      const current = waypoints[i];
      
      if (prev && current) {
        distance += prev.distanceTo(current);
      }
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
    const grid: Vec3[] = [];
    const start = this.area.start;
    const end = this.area.end;
    
    // Use WorldTracker to find optimal farming locations based on biome
    for (let x = start.x; x <= end.x; x++) {
      for (let z = start.z; z <= end.z; z++) {
        const position = new Vec3(x, start.y, z);
        const biome = this.worldTracker.getBiomeAt(position);
        
        // Check if this biome is suitable for farming
        if (biome && this.isSuitableBiomeForFarming(biome)) {
          grid.push(position);
        }
      }
    }
    
    return grid;
  }

  private isSuitableBiomeForFarming(biome: string): boolean {
    const suitableBiomes = new Set([
      'plains',
      'sunflower_plains',
      'river',
      'beach',
      'forest',
      'flower_forest'
    ]);
    return suitableBiomes.has(biome);
  }

  public override async navigateTo(position: Vec3): Promise<void> {
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

  private async ensureTools(): Promise<void> {
    const toolManager = this.bot.getToolManager();
    await toolManager.ensureTool('hoe', this.cropType);
  }

  private async checkWaterSources(): Promise<void> {
    // Use WorldTracker to find water sources in the area
    const waterLocations = this.worldTracker.getResourceLocations('water');
    this.waterSources = waterLocations.filter(pos => 
      pos.x >= this.area.start.x && 
      pos.x <= this.area.end.x && 
      pos.z >= this.area.start.z && 
      pos.z <= this.area.end.z
    );

    if (this.waterSources.length === 0) {
      logger.warn('No water sources found in farming area');
      // Try to find water sources in nearby chunks
      const botPosition = this.mineflayerBot.entity.position;
      const nearbyWater = await this.worldTracker.findResource('water');
      if (nearbyWater) {
        logger.info(`Found water source at ${nearbyWater}`);
        this.waterSources.push(nearbyWater);
      }
    }
  }

  private async harvestAndReplant(block: any): Promise<boolean> {
    try {
      const position = block.position;
      const biome = this.worldTracker.getBiomeAt(position);
      
      if (!biome || !this.isSuitableBiomeForFarming(biome)) {
        logger.warn(`Skipping harvest at ${position} - unsuitable biome: ${biome}`);
        return false;
      }

      // Harvest the crop
      await this.mineflayerBot.dig(block);
      
      // Update world tracker
      this.worldTracker.clearCaches(); // Clear caches to ensure fresh data
      
      // Replant
      const seedItem = this.mineflayerBot.inventory.items().find(item => 
        item.name === `${this.cropType}_seeds` || 
        item.name === this.cropType
      );
      
      if (seedItem) {
        await this.mineflayerBot.equip(seedItem, 'hand');
        await this.mineflayerBot.placeBlock(block, new Vec3(0, 1, 0));
      }
      
      this.cropsProcessed++;
      return true;
    } catch (error) {
      logger.error(`Failed to harvest and replant at ${block.position}:`, error);
      return false;
    }
  }

  override async execute(task: Task | null, taskId: string): Promise<TaskResult> {
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

  override async validateTask(): Promise<void> {
    if (!this.cropType) {
      throw new Error('Crop type is required');
    }
    
    if (!this.area || !this.area.start || !this.area.end) {
      throw new Error('Farming area is required');
    }
  }

  override async initializeProgress(): Promise<void> {
    this.startTime = Date.now();
    this.cropsProcessed = 0;
    this.cropStates = [];
    await this.checkWaterSources();
  }

  override async performTask(): Promise<void> {
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
    // Refresh crop positions and growth stages
    this.cropStates = await this.scanFarmArea();
    
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
        waypoints: this.optimizer ? this.optimizer.getOptimizedPath() : this.generateFarmingGrid(),
        distance: this.calculatePathDistance(),
        efficiency: this.calculatePathEfficiency()
      },
      performance: {
        farmingEfficiency: this.calculateFarmingEfficiency(),
        harvestRate: this.calculateHarvestRate(),
        growthRate: this.calculateGrowthRate()
      },
      farms: {
        [`${this.cropType}_farm`]: {
          layout: {
            dimensions: {
              width: Math.abs(this.area.end.x - this.area.start.x),
              length: Math.abs(this.area.end.z - this.area.start.z)
            },
            plotArrangement: 'grid',
            cropDistribution: { [this.cropType]: this.cropStates.length },
            waterSources: this.waterSources,
            lightSources: []
          },
          crops: this.cropStates.map(c => ({
            type: this.cropType,
            growthStage: c.growth,
            maxGrowthStage: 7,
            growthRate: 0.1,
            waterNeeds: 0.5,
            timeToHarvest: (7 - c.growth) * 1000 * 60
          })),
          environment: {
            soilMoisture: 1.0,
            lightLevel: 15,
            biome: String(this.mineflayerBot.world.getBiome(this.mineflayerBot.entity.position) || 'plains'),
            temperature: 0.8,
            rainfall: 0.5
          },
          system: {
            type: 'manual',
            components: ['player'],
            efficiencyRating: this.calculateFarmingEfficiency(),
            redstoneComplexity: 0
          },
          lastHarvest: Date.now() - (60 * 1000),
          predictedNextHarvest: Date.now() + (60 * 1000 * 10),
          yieldHistory: []
        }
      },
      predictions: {
        yields: [],
        optimizations: []
      },
      farmingSkillLevel: 0,
      timestamp: Date.now()
    };
  }

  override async updateProgress(progress: number): Promise<void> {
    // Update progress
    await super.updateProgress(progress);
  }

  override shouldRetry(): boolean {
    return false;
  }

  override async retry(): Promise<void> {
    // Retry logic
    await super.retry();
  }

  override stop(): void {
    this.isStopped = true;
  }

  private async scanFarmArea(): Promise<Array<{ position: Vec3; growth: number; lastHarvest: number }>> {
    const result: Array<{ position: Vec3; growth: number; lastHarvest: number }> = [];
    const bot = this.mineflayerBot;
    
    // Ensure area boundaries are ordered correctly
    const minX = Math.min(this.area.start.x, this.area.end.x);
    const maxX = Math.max(this.area.start.x, this.area.end.x);
    const minY = Math.min(this.area.start.y, this.area.end.y);
    const maxY = Math.max(this.area.start.y, this.area.end.y);
    const minZ = Math.min(this.area.start.z, this.area.end.z);
    const maxZ = Math.max(this.area.start.z, this.area.end.z);
    
    // Scan the area for crops
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const position = new Vec3(x, y, z);
          const block = bot.blockAt(position);
          
          if (!block) continue;
          
          // Check if this is the type of crop we're looking for
          if (this.isCropBlock(block)) {
            // Get growth stage from block metadata
            const metadata = block.metadata || 0;
            const growthStage = this.getCropGrowthStage(block, metadata);
            
            // Add to result with current timestamp as last harvest if fully grown
            const lastHarvest = growthStage >= 7 ? Date.now() : Date.now() - (60 * 1000 * 10);
            result.push({
              position,
              growth: growthStage,
              lastHarvest
            });
          }
        }
      }
    }
    
    logger.debug(`Found ${result.length} ${this.cropType} crops in the farm area`);
    return result;
  }
  
  private isCropBlock(block: any): boolean {
    switch (this.cropType) {
      case 'wheat':
        return block.name === 'wheat';
      case 'carrots':
        return block.name === 'carrots';
      case 'potatoes':
        return block.name === 'potatoes';
      case 'beetroot':
        return block.name === 'beetroots';
      default:
        return false;
    }
  }
  
  private getCropGrowthStage(block: any, metadata: number): number {
    // Most crops use metadata directly as growth stage (0-7)
    if (this.cropType === 'wheat' || this.cropType === 'carrots' || this.cropType === 'potatoes') {
      return metadata;
    }
    
    // Beetroot uses different metadata range (0-3)
    if (this.cropType === 'beetroot') {
      return Math.floor((metadata / 3) * 7); // Convert to 0-7 scale
    }
    
    return 0;
  }
} 