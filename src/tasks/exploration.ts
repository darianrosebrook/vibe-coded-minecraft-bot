import { MinecraftBot } from '../bot/bot';
import { Task, TaskParameters } from '../types/task';
import { Bot as MineflayerBot } from 'mineflayer';
import pathfinder from 'mineflayer-pathfinder';
import { BaseTask, TaskOptions } from './base';
import { CommandHandler } from '../commands';
import { Vec3 } from 'vec3';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { ExplorationOptimizer } from '../ml/reinforcement/explorationOptimizer';
import { ExplorationMLState, ResourceDistribution, BiomeTransition } from '../ml/state/explorationState';
import { CentralizedDataCollector } from '../ml/state/centralized_data_collector';
import { TaskStorage } from '../storage/taskStorage';
import { TrainingDataStorage } from '../ml/state/training_data_storage';

export type ExplorationTaskParameters = TaskOptions & {
  targetType: 'resource' | 'biome';
  targetName: string;
  radius?: number;
  spacing?: number;
  usePathfinding?: boolean;
  avoidWater?: boolean;
}

export class ExplorationTask extends BaseTask {
  private targetType: 'resource' | 'biome';
  private targetName: string;
  protected radius: number;
  private spacing: number;
  private usePathfinding: boolean;
  private avoidWater: boolean;
  private optimizer: ExplorationOptimizer;
  private discoveredResources: ResourceDistribution[] = [];
  private discoveredBiomes: Array<{ name: string; position: Vec3; size: number }> = [];
  private discoveredLocations: Array<{ position: Vec3; type: string }> = [];
  protected stopRequested: boolean = false;
  protected dataCollector: CentralizedDataCollector;
  protected storage: TaskStorage;
  protected trainingStorage: TrainingDataStorage;
  protected startTime: number = 0;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: ExplorationTaskParameters) {
    super(bot, commandHandler, {
      ...options,
      useML: options.useML ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      timeout: options.timeout ?? 70000
    });
    
    this.mineflayerBot.loadPlugin(pathfinder.pathfinder);
    
    this.targetType = options.targetType;
    this.targetName = options.targetName;
    this.radius = options.radius || 100;
    this.spacing = options.spacing || 10;
    this.usePathfinding = options.usePathfinding ?? true;
    this.avoidWater = options.avoidWater ?? false;
    
    this.optimizer = new ExplorationOptimizer();
    
    // Initialize data collection
    this.dataCollector = new CentralizedDataCollector(this.mineflayerBot);
    this.storage = new TaskStorage('./data');
    this.trainingStorage = new TrainingDataStorage();
    this.dataCollector.start();
  }

  protected async getTaskSpecificState(): Promise<ExplorationMLState> {
    const currentBiome = this.mineflayerBot.world.getBiome(this.mineflayerBot.entity.position);
    
    return {
      currentPosition: this.mineflayerBot.entity.position,
      targetResource: this.targetType === 'resource' ? this.targetName : undefined,
      targetBiome: this.targetType === 'biome' ? this.targetName : undefined,
      discoveredResources: this.discoveredResources.map(r => ({
        type: r.type,
        position: r.position,
        quantity: r.quantity,
        biome: r.biome,
        depth: r.position.y,
        timestamp: Date.now()
      })),
      biomeTransitions: this.discoveredBiomes.map(b => ({
        fromBiome: b.name,
        toBiome: this.bot.getBiomeData(currentBiome).name,
        position: b.position,
        distance: b.position.distanceTo(this.mineflayerBot.entity.position),
        timestamp: Date.now()
      })),
      currentPath: {
        waypoints: this.generateExplorationGrid(),
        distance: this.calculatePathDistance(),
        resourceCount: this.discoveredResources.length,
        biomeCount: this.discoveredBiomes.length,
        efficiency: this.calculatePathEfficiency()
      },
      performanceMetrics: {
        explorationEfficiency: this.calculateExplorationEfficiency(),
        resourceDiscoveryRate: this.calculateResourceDiscoveryRate(),
        biomeCoverage: this.calculateBiomeCoverage(),
        pathOptimization: this.calculatePathEfficiency()
      },
      timestamp: Date.now()
    };
  }

  private calculateResourceDiscoveryEfficiency(): number {
    const timeElapsed = Date.now() - this.startTime;
    const resourcesPerSecond = this.discoveredResources.length / (timeElapsed / 1000);
    const maxEfficiency = 5.0;
    return this.calculateEfficiency('resource_discovery', resourcesPerSecond, maxEfficiency);
  }

  private calculateBiomeTransitionEfficiency(): number {
    const timeElapsed = Date.now() - this.startTime;
    const biomesPerSecond = this.discoveredBiomes.length / (timeElapsed / 1000);
    const maxEfficiency = 2.0;
    return this.calculateEfficiency('biome_transition', biomesPerSecond, maxEfficiency);
  }

  private calculatePathDistance(): number {
    const waypoints = this.generateExplorationGrid();
    let distance = 0;
    for (let i = 1; i < waypoints.length; i++) {
      distance += waypoints[i - 1].distanceTo(waypoints[i]);
    }
    return distance;
  }

  private calculatePathEfficiency(): number {
    const distance = this.calculatePathDistance();
    const optimalDistance = this.radius * 2;
    return (optimalDistance / distance) * 100;
  }

  private calculateExplorationEfficiency(): number {
    const timeElapsed = Date.now() - this.startTime;
    const locationsPerSecond = this.discoveredLocations.length / (timeElapsed / 1000);
    const maxEfficiency = 3.0;
    return this.calculateEfficiency('exploration', locationsPerSecond, maxEfficiency);
  }

  private calculateResourceDiscoveryRate(): number {
    const timeElapsed = Date.now() - this.startTime;
    return (this.discoveredResources.length / timeElapsed) * 1000;
  }

  private calculateBiomeCoverage(): number {
    const totalBiomes = this.bot.getBiomeList().length;
    const discoveredBiomeTypes = new Set(this.discoveredBiomes.map(b => b.name));
    return (discoveredBiomeTypes.size / totalBiomes) * 100;
  }

  private generateExplorationGrid(): Vec3[] {
    const waypoints: Vec3[] = [];
    const center = this.mineflayerBot.entity.position;
    
    for (let x = -this.radius; x <= this.radius; x += this.spacing) {
      for (let z = -this.radius; z <= this.radius; z += this.spacing) {
        waypoints.push(new Vec3(center.x + x, center.y, center.z + z));
      }
    }
    
    return waypoints;
  }

  protected async navigateTo(position: Vec3): Promise<void> {
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

  private async exploreArea(): Promise<boolean> {
    const waypoints = this.generateExplorationGrid();
    
    for (const waypoint of waypoints) {
      if (this.stopRequested) return false;
      
      await this.navigateTo(waypoint);
      
      const block = this.mineflayerBot.blockAt(waypoint);
      if (block && this.isInterestingLocation(block)) {
        this.discoveredLocations.push({
          position: waypoint,
          type: block.name
        });
        
        if (this.targetType === 'resource' && block.name === this.targetName) {
          this.discoveredResources.push({
            type: block.name,
            position: waypoint,
            quantity: 1,
            biome: this.mineflayerBot.world.getBiome(waypoint),
            timestamp: Date.now()
          });
        }
      }
      
      const currentBiome = this.mineflayerBot.world.getBiome(waypoint);
      if (this.targetType === 'biome' && currentBiome === this.targetName) {
        this.discoveredBiomes.push({
          name: currentBiome,
          position: waypoint,
          size: 1
        });
      }
      
      await this.updateMLState();
    }
    
    return true;
  }

  private isInterestingLocation(block: any): boolean {
    const interestingBlocks = [
      'diamond_ore', 'gold_ore', 'iron_ore', 'coal_ore',
      'emerald_ore', 'lapis_ore', 'redstone_ore',
      'chest', 'spawner', 'dungeon'
    ];
    
    return interestingBlocks.includes(block.name);
  }

  async validateTask(): Promise<void> {
    await super.validateTask();
    
    if (!this.targetType || !this.targetName) {
      throw new Error('Target type and name are required');
    }
    
    if (this.radius <= 0) {
      throw new Error('Radius must be greater than 0');
    }
  }

  async initializeProgress(): Promise<void> {
    await super.initializeProgress();
    this.discoveredResources = [];
    this.discoveredBiomes = [];
    this.discoveredLocations = [];
  }

  async performTask(): Promise<void> {
    this.startTime = Date.now();
    await this.initializeMLState();
    
    while (!this.stopRequested) {
      const success = await this.exploreArea();
      if (!success) break;
      
      await this.updateProgress((this.discoveredLocations.length / (this.radius * this.radius)) * 100);
    }
  }

  protected async handleError(error: Error, metadata: Record<string, any>): Promise<void> {
    await super.handleError(error, {
      ...metadata,
      targetType: this.targetType,
      targetName: this.targetName,
      discoveredResources: this.discoveredResources.length,
      discoveredBiomes: this.discoveredBiomes.length
    });
  }

  stop(): void {
    this.stopRequested = true;
  }
} 