import { MinecraftBot } from '../bot/bot';
import pathfinder from 'mineflayer-pathfinder';
import { BaseTask, TaskOptions } from './base';
import { CommandHandler } from '../commands';
import { Vec3 } from 'vec3'; 
import { ExplorationMLState, ResourceDistribution, BiomeTransition } from '../ml/state/explorationState';
import { CentralizedDataCollector } from '../ml/state/centralized_data_collector';
import { TaskStorage } from '../storage/taskStorage';
import { TrainingDataStorage } from '../ml/state/training_data_storage';
import { WorldTracker } from '@/bot/worldTracking';

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
  protected override radius: number;
  private spacing: number;
  private usePathfinding: boolean;
  private avoidWater: boolean; 
  private discoveredResources: ResourceDistribution[] = [];
  private discoveredBiomes: Array<{ name: string; position: Vec3; size: number }> = [];
  private discoveredLocations: Array<{ position: Vec3; type: string }> = [];
  protected override stopRequested: boolean = false;
  protected override dataCollector: CentralizedDataCollector;
  protected override storage: TaskStorage;
  protected override trainingStorage: TrainingDataStorage;
  protected override startTime: number = 0;
  protected override worldTracker: WorldTracker; 


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

    // Initialize data collection
    this.dataCollector = new CentralizedDataCollector(this.mineflayerBot);
    this.storage = new TaskStorage('./data');
    this.trainingStorage = new TrainingDataStorage();
    this.dataCollector.start();

    this.worldTracker = new WorldTracker(bot);
  }

  protected async getTaskSpecificState(): Promise<ExplorationMLState> {
    const currentPosition = this.mineflayerBot.entity.position; 

    return {
      discoveredResources: this.discoveredResources,
      biomeTransitions: this.calculateBiomeTransitions(),
      currentPath: {
        waypoints: this.generateExplorationGrid(),
        distance: this.calculatePathDistance(),
        efficiency: this.calculatePathEfficiency(),
        resourceCount: this.discoveredResources.length,
        biomeCount: this.discoveredBiomes.length
      },
      performanceMetrics: {
        explorationEfficiency: this.calculateExplorationEfficiency(),
        resourceDiscoveryRate: this.calculateResourceDiscoveryRate(),
        biomeCoverage: this.calculateBiomeCoverage(),
        pathOptimization: this.calculatePathOptimization()
      },
      currentPosition: currentPosition,
      timestamp: Date.now()
    };
  }
 

  private calculatePathOptimization(): number {
    // const state: ExplorationMLState = {
    //   currentPosition: this.mineflayerBot.entity.position,
    //   discoveredResources: this.discoveredResources,
    //   biomeTransitions: this.calculateBiomeTransitions(),
    //   currentPath: {
    //     waypoints: this.generateExplorationGrid(),
    //     distance: this.calculatePathDistance(),
    //     efficiency: this.calculatePathEfficiency(),
    //     resourceCount: this.discoveredResources.length,
    //     biomeCount: this.discoveredBiomes.length
    //   },
    //   performanceMetrics: {
    //     explorationEfficiency: this.calculateExplorationEfficiency(),
    //     resourceDiscoveryRate: this.calculateResourceDiscoveryRate(),
    //     biomeCoverage: this.calculateBiomeCoverage(),
    //     pathOptimization: 0 // Default value to avoid circular reference
    //   },
    //   timestamp: Date.now()
    // };
    
    // Direct calculation without optimizer
    const distance = this.calculatePathDistance();
    const optimalDistance = this.radius * 2;
    return (optimalDistance / distance) * 100;
  }

  private calculatePathDistance(): number {
    const waypoints = this.generateExplorationGrid();
    let distance = 0;
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
    const totalBiomes = 20; // Fallback to a reasonable estimate of Minecraft biome types
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

  protected override async navigateTo(position: Vec3): Promise<void> {
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
    const botPosition = this.mineflayerBot.entity.position;
    const startX = Math.floor(botPosition.x - this.radius);
    const startZ = Math.floor(botPosition.z - this.radius);
    const endX = Math.floor(botPosition.x + this.radius);
    const endZ = Math.floor(botPosition.z + this.radius);

    let foundTarget = false;

    for (let x = startX; x <= endX; x += this.spacing) {
      for (let z = startZ; z <= endZ; z += this.spacing) {
        if (this.stopRequested) return foundTarget;

        const position = new Vec3(x, botPosition.y, z);
        const biome = this.worldTracker.getBiomeAt(position);

        if (this.targetType === 'biome' && biome === this.targetName) {
          // Found target biome
          this.discoveredBiomes.push({
            name: biome,
            position,
            size: this.calculateBiomeSize(position, biome)
          });
          foundTarget = true;
        } else if (this.targetType === 'resource') {
          // Check for resources in this biome
          const knownBlocks = biome ? this.worldTracker.getKnownBlocks(biome) : [];
          if (knownBlocks.includes(this.targetName)) {
            const resourceLocations = this.worldTracker.getResourceLocations(this.targetName);
            if (resourceLocations.some(loc => loc.equals(position))) {
              this.discoveredResources.push({
                type: this.targetName,
                position,
                quantity: 1,
                biome: biome || 'unknown',
                depth: position.y,
                timestamp: Date.now()
              });
              foundTarget = true;
            }
          }
        }

        // Record any interesting locations
        const block = this.mineflayerBot.world.getBlock(position);
        if (block && this.isInterestingLocation(block)) {
          this.discoveredLocations.push({
            position,
            type: block.name
          });
        }
      }
    }

    return foundTarget;
  }

  private calculateBiomeSize(position: Vec3, biome: string): number {
    let size = 0;
    const visited = new Set<string>();
    const queue: Vec3[] = [position];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.x},${current.z}`;

      if (visited.has(key)) continue;
      visited.add(key);
      size++;

      // Check adjacent positions
      const directions = [
        new Vec3(1, 0, 0),
        new Vec3(-1, 0, 0),
        new Vec3(0, 0, 1),
        new Vec3(0, 0, -1)
      ];

      for (const dir of directions) {
        const next = current.plus(dir);
        const nextBiome = this.worldTracker.getBiomeAt(next);
        if (nextBiome === biome) {
          queue.push(next);
        }
      }
    }

    return size;
  }

  private isInterestingLocation(block: any): boolean {
    const interestingBlocks = new Set([
      'diamond_ore',
      'emerald_ore',
      'gold_ore',
      'iron_ore',
      'coal_ore',
      'lapis_ore',
      'redstone_ore',
      'ancient_debris',
      'spawner',
      'chest',
      'end_portal_frame'
    ]);

    return interestingBlocks.has(block.name);
  }

  private calculateBiomeTransitions(): BiomeTransition[] {
    const transitions: BiomeTransition[] = [];
    const visited = new Set<string>();

    for (const biome of this.discoveredBiomes) {
      const key = `${biome.position.x},${biome.position.z}`;
      if (visited.has(key)) continue;
      visited.add(key);

      transitions.push({
        fromBiome: biome.name,
        toBiome: this.findAdjacentBiome(biome.position),
        position: biome.position,
        distance: biome.position.distanceTo(this.mineflayerBot.entity.position),
        timestamp: Date.now()
      });
    }

    return transitions;
  }

  private findAdjacentBiome(position: Vec3): string {
    const directions = [
      new Vec3(1, 0, 0),
      new Vec3(-1, 0, 0),
      new Vec3(0, 0, 1),
      new Vec3(0, 0, -1)
    ];

    for (const dir of directions) {
      const adjacent = position.plus(dir);
      const biome = this.worldTracker.getBiomeAt(adjacent);
      if (biome) {
        return biome;
      }
    }

    return 'unknown';
  }

  override async validateTask(): Promise<void> {
    await super.validateTask();

    if (!this.targetType || !this.targetName) {
      throw new Error('Target type and name are required');
    }

    if (this.radius <= 0) {
      throw new Error('Radius must be greater than 0');
    }
  }

  override async initializeProgress(): Promise<void> {
    await super.initializeProgress();
    this.discoveredResources = [];
    this.discoveredBiomes = [];
    this.discoveredLocations = [];
  }

  override async performTask(): Promise<void> {
    this.startTime = Date.now();
    await this.initializeMLState();

    while (!this.stopRequested) {
      const success = await this.exploreArea();
      if (!success) break;

      await this.updateProgress((this.discoveredLocations.length / (this.radius * this.radius)) * 100);
    }
  }

  protected override async handleError(error: Error, metadata: Record<string, any>): Promise<void> {
    await super.handleError(error, {
      ...metadata,
      taskType: 'exploration'
    });
  }

  override stop(): void {
    this.stopRequested = true;
  }
} 