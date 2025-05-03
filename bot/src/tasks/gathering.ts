import { MinecraftBot } from '@/bot/bot';
import { CommandHandler } from '@/commands';
import { BaseTask, TaskOptions } from './base';
import { MLTaskOptimizer } from '@/ml/optimization/task_optimizer';
import { EnhancedResourceNeedPredictor } from '@/ml/prediction/resource_need_predictor';
import { IDataCollector } from '@/types/ml/interfaces';
import { TrainingDataCollector } from '@/ml/data/TrainingDataCollector';
import { Vec3 } from 'vec3';
import { Block } from 'prismarine-block';
import logger from '@/utils/observability/logger';
import pathfinder from 'mineflayer-pathfinder';

interface GatheringMLState {
  resourceDistribution: {
    type: string;
    positions: Vec3[];
    quantities: number[];
    efficiency: number;
  };
  gatheringPath: {
    waypoints: Vec3[];
    distance: number;
    efficiency: number;
  };
  performance: {
    gatheringEfficiency: number;
    resourceDiscoveryRate: number;
    toolDurability: number;
  };
}

export type GatheringTaskParameters = TaskOptions & {
  resourceType: string;
  quantity?: number;
  radius?: number;
  usePathfinding?: boolean;
  avoidWater?: boolean;
  spacing?: number;
}

export class GatheringTask extends BaseTask {
  private resourceType: string;
  private quantity: number;
  protected override radius: number;
  private spacing: number;
  private gatheredCount: number = 0;
  private optimizer: MLTaskOptimizer;
  private mlState: GatheringMLState | null = null;
  private discoveredResources: Array<{ type: string; position: Vec3; quantity: number }> = [];
  protected retryDelay: number;

  constructor(
    bot: MinecraftBot,
    commandHandler: CommandHandler,
    options: GatheringTaskParameters,
    collector?: IDataCollector
  ) {
    super(bot, commandHandler, options);
    this.resourceType = options.resourceType;
    this.quantity = options.quantity || 1;
    this.radius = options.radius || 10;
    this.spacing = options.spacing || 2;
    this.retryDelay = options.retryDelay ?? 5000;

    // Create or use the provided data collector
    const dataCollector = collector || new TrainingDataCollector(this.mineflayerBot);

    this.optimizer = new MLTaskOptimizer(
      this.stateManager,
      new EnhancedResourceNeedPredictor(
        this.mineflayerBot,
        dataCollector
      )
    );
    this.initializeMLState();
  }

  protected override async initializeMLState(): Promise<void> {
    this.mlState = {
      resourceDistribution: {
        type: this.resourceType,
        positions: [],
        quantities: [],
        efficiency: 0
      },
      gatheringPath: {
        waypoints: [],
        distance: 0,
        efficiency: 0
      },
      performance: {
        gatheringEfficiency: 0,
        resourceDiscoveryRate: 0,
        toolDurability: 100
      }
    };
  }

  protected async getTaskSpecificState(): Promise<GatheringMLState> {
    const currentPosition = this.mineflayerBot.entity.position;
    const biome = this.worldTracker.getBiomeAt(currentPosition);
    const knownBlocks = biome ? this.worldTracker.getKnownBlocks(biome) : [];

    return {
      resourceDistribution: {
        type: this.resourceType,
        positions: this.discoveredResources.map(r => r.position),
        quantities: this.discoveredResources.map(r => r.quantity),
        efficiency: this.calculateGatheringEfficiency()
      },
      gatheringPath: {
        waypoints: this.generateGatheringGrid(),
        distance: this.calculatePathDistance(),
        efficiency: this.calculatePathEfficiency()
      },
      performance: {
        gatheringEfficiency: this.calculateGatheringEfficiency(),
        resourceDiscoveryRate: this.calculateResourceDiscoveryRate(),
        toolDurability: this.calculateToolDurability()
      }
    };
  }

  private calculateResourceDiscoveryEfficiency(): number {
    const totalArea = Math.PI * this.radius * this.radius;
    const discoveredArea = this.discoveredResources.length * this.spacing * this.spacing;
    return (discoveredArea / totalArea) * 100;
  }

  private calculatePathDistance(): number {
    if (!this.mlState?.gatheringPath.waypoints.length) return 0;

    let distance = 0;
    for (let i = 1; i < this.mlState.gatheringPath.waypoints.length; i++) {
      const prev = this.mlState.gatheringPath.waypoints[i - 1]
      const current = this.mlState.gatheringPath.waypoints[i];
      if (prev && current) {
        distance += prev.distanceTo(current);
      }
      else {
        distance += 0;
        this.bot.chat('No path found to get the required resources');
      }
    }
    return distance;
  }

  private calculatePathEfficiency(): number {
    const distance = this.calculatePathDistance();
    const optimalDistance = this.radius * 2;
    return (optimalDistance / distance) * 100;
  }

  private calculateGatheringEfficiency(): number {
    return (this.gatheredCount / this.quantity) * 100;
  }

  private calculateResourceDiscoveryRate(): number {
    const timeElapsed = Date.now() - this.startTime;
    return (this.discoveredResources.length / timeElapsed) * 1000;
  }

  private calculateToolDurability(): number {
    const tool = this.mineflayerBot.inventory.items().find(item =>
      item.name.includes('axe')
    );
    return tool ? (tool.durabilityUsed / tool.maxDurability) * 100 : 100;
  }

  private generateGatheringGrid(): Vec3[] {
    const grid: Vec3[] = [];
    const botPosition = this.mineflayerBot.entity.position;
    
    // Use WorldTracker to find optimal gathering locations based on biome
    for (let x = botPosition.x - this.radius; x <= botPosition.x + this.radius; x += this.spacing) {
      for (let z = botPosition.z - this.radius; z <= botPosition.z + this.radius; z += this.spacing) {
        const position = new Vec3(x, botPosition.y, z);
        const biome = this.worldTracker.getBiomeAt(position);
        
        if (biome && this.worldTracker.getKnownBlocks(biome).includes(this.resourceType)) {
          grid.push(position);
        }
      }
    }
    
    return grid;
  }

  private async findResources(): Promise<Vec3[]> {
    const resources: Vec3[] = [];
    const botPosition = this.mineflayerBot.entity.position;
    
    logger.info('Starting resource search', {
      resourceType: this.resourceType,
      radius: this.radius,
      position: botPosition
    });
    
    // First check known resource locations from WorldTracker
    const knownLocations = this.worldTracker.getResourceLocations(this.resourceType);
    if (knownLocations.length > 0) {
      logger.info(`Found ${knownLocations.length} known locations for ${this.resourceType}`);
      resources.push(...knownLocations);
    }

    // If we need more resources, scan in a spiral pattern
    if (resources.length < this.quantity) {
      logger.debug('Initiating spiral scan for additional resources', {
        currentCount: resources.length,
        targetQuantity: this.quantity
      });

      const scannedPositions = new Set<string>();
      const maxRadius = this.radius;
      let x = 0;
      let z = 0;
      let dx = 0;
      let dz = -1;

      for (let i = 0; i < Math.pow(maxRadius * 2, 2) && resources.length < this.quantity; i++) {
        if ((-maxRadius < x && x <= maxRadius) && (-maxRadius < z && z <= maxRadius)) {
          const worldX = Math.floor(botPosition.x + x);
          const worldZ = Math.floor(botPosition.z + z);
          const posKey = `${worldX},${worldZ}`;

          if (!scannedPositions.has(posKey)) {
            scannedPositions.add(posKey);

            // Scan vertically at this x,z coordinate
            for (let y = -3; y <= 3; y++) {
              const position = new Vec3(worldX, Math.floor(botPosition.y + y), worldZ);
              const block = this.mineflayerBot.blockAt(position);
              
              if (block && block.name === this.resourceType) {
                // Check if this block is in a known biome for this resource
                const biome = this.worldTracker.getBiomeAt(position);
                if (biome && this.worldTracker.getKnownBlocks(biome).includes(this.resourceType)) {
                  resources.push(position);
                  logger.debug('Found resource block', {
                    position,
                    biome,
                    totalFound: resources.length
                  });
                  if (resources.length >= this.quantity) break;
                }
              }
            }
          }
        }

        // Move in a spiral pattern
        if (x === z || (x < 0 && x === -z) || (x > 0 && x === 1 - z)) {
          const temp = dx;
          dx = -dz;
          dz = temp;
        }
        x += dx;
        z += dz;
      }
    }

    logger.info('Resource search completed', {
      totalFound: resources.length,
      targetQuantity: this.quantity,
      positions: resources.map(r => ({ x: r.x, y: r.y, z: r.z }))
    });

    return resources;
  }

  private async gatherResource(block: Block): Promise<boolean> {
    try {
      const position = block.position;
      const biome = this.worldTracker.getBiomeAt(position);
      
      logger.debug('Attempting to gather resource', {
        position,
        biome,
        blockType: block.name
      });
      
      if (!biome || !this.worldTracker.getKnownBlocks(biome).includes(this.resourceType)) {
        logger.warn(`Skipping gathering at ${position} - unsuitable biome: ${biome}`);
        return false;
      }

      // Update world tracker
      this.worldTracker.clearCaches(); // Clear caches to ensure fresh data
      
      // Check if we can reach the block
      const canSee = this.mineflayerBot.canSeeBlock(block);
      if (!canSee) {
        logger.warn(`Cannot see block at ${position}, trying to get closer`);
        await this.navigateTo(position);
      }

      logger.debug('Digging block', { position });
      await this.mineflayerBot.dig(block);
      this.gatheredCount++;
      
      logger.info('Successfully gathered resource', {
        position,
        gatheredCount: this.gatheredCount,
        targetQuantity: this.quantity
      });
      
      // Record success in training data
      if (this.dataCollector) {
        await this.dataCollector.recordPrediction(
          'gathering',
          { resourceType: this.resourceType, position },
          { success: true, quantity: 1 },
          true,
          1.0,
          0
        );
      }

      return true;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to gather resource at ${block.position}:`, errorMessage);
      
      // Record failure in training data
      if (this.dataCollector) {
        await this.dataCollector.recordPrediction(
          'gathering',
          { resourceType: this.resourceType, position: block.position },
          { success: false, error: errorMessage },
          false,
          1.0,
          0
        );
      }

      return false;
    }
  }

  override async validateTask(): Promise<void> {
    await super.validateTask();
    
    if (!this.resourceType) {
      throw new Error('Resource type is required');
    }
    
    if (this.quantity && this.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
  }

  override async initializeProgress(): Promise<void> {
    await super.initializeProgress();
    this.gatheredCount = 0;
    this.discoveredResources = [];
  }

  override async performTask(): Promise<void> {
    logger.info('Starting gathering task', {
      resourceType: this.resourceType,
      quantity: this.quantity,
      radius: this.radius
    });

    await this.initializeMLState();
    await this.ensureTool('axe', this.resourceType);
    
    const resources = await this.findResources();
    if (resources.length === 0) {
      const error = `No ${this.resourceType} found within radius ${this.radius}`;
      logger.error(error);
      throw new Error(error);
    }

    logger.info('Beginning resource gathering', {
      resourceCount: resources.length,
      positions: resources.map(r => ({ x: r.x, y: r.y, z: r.z }))
    });

    for (const position of resources) {
      if (this.isStopped) {
        logger.info('Task stopped by user');
        break;
      }
      
      await this.navigateTo(position);
      const block = this.mineflayerBot.blockAt(position);
      
      if (block && block.name === this.resourceType) {
        const success = await this.gatherResource(block);
        
        if (!success) {
          this.retryCount++;
          logger.warn('Failed to gather resource, retrying', {
            position,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries
          });

          if (this.retryCount > this.maxRetries) {
            const error = 'Failed to gather resource after multiple attempts';
            logger.error(error);
            throw new Error(error);
          }
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }
        
        await this.updateProgress((this.gatheredCount / this.quantity) * 100);
      }
    }

    logger.info('Gathering task completed', {
      gatheredCount: this.gatheredCount,
      targetQuantity: this.quantity,
      successRate: (this.gatheredCount / this.quantity) * 100
    });
  }
} 