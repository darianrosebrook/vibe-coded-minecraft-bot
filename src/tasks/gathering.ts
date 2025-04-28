import { MinecraftBot } from '../bot/bot';
import { BaseTask, TaskOptions } from './base';
import { Bot as MineflayerBot } from 'mineflayer';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Block } from 'prismarine-block';
import { CommandHandler } from '../commands';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
import { MLTaskOptimizer } from '../ml/task/optimizer';

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
  private radius: number;
  private spacing: number;
  private gatheredCount: number = 0;
  private optimizer: MLTaskOptimizer;
  private mlState: GatheringMLState | null = null;
  private discoveredResources: Array<{ type: string; position: Vec3; quantity: number }> = [];

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: GatheringTaskParameters) {
    super(bot, commandHandler, {
      ...options,
      useML: options.useML ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      timeout: options.timeout ?? 70000
    });
    
    this.mineflayerBot.loadPlugin(pathfinder.pathfinder);

    this.resourceType = options.resourceType;
    this.quantity = options.quantity || 1;
    this.radius = options.radius || 10;
    this.spacing = options.spacing || 2;

    this.optimizer = new MLTaskOptimizer();
    this.initializeMLState();
  }

  private initializeMLState(): void {
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
    return {
      resourceDistribution: {
        type: this.resourceType,
        positions: this.discoveredResources.map(r => r.position),
        quantities: this.discoveredResources.map(r => r.quantity),
        efficiency: this.calculateResourceDiscoveryEfficiency()
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
      const prev = this.mlState.gatheringPath.waypoints[i - 1];
      const current = this.mlState.gatheringPath.waypoints[i];
      distance += prev.distanceTo(current);
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
    const botPosition = this.mineflayerBot.entity.position;
    const waypoints: Vec3[] = [];

    for (let r = 0; r <= this.radius; r += this.spacing) {
      for (let theta = 0; theta < 2 * Math.PI; theta += Math.PI / 4) {
        const x = botPosition.x + r * Math.cos(theta);
        const z = botPosition.z + r * Math.sin(theta);
        waypoints.push(new Vec3(x, botPosition.y, z));
      }
    }

    return waypoints;
  }

  private async findResources(): Promise<Vec3[]> {
    const worldTracker = this.bot.getWorldTracker();
    if (!worldTracker) {
      throw new Error('World tracker not initialized');
    }

    const botPosition = this.mineflayerBot.entity.position;
    const resources: Vec3[] = [];

    const foundResources = await worldTracker.findBlocks(this.resourceType, botPosition, this.radius);
    if (foundResources) {
      resources.push(...foundResources);
    }

    if (resources.length === 0) {
      for (let x = -this.radius; x <= this.radius; x++) {
        for (let z = -this.radius; z <= this.radius; z++) {
          const position = botPosition.offset(x, 0, z);
          const block = this.mineflayerBot.blockAt(position);
          if (block && block.name === this.resourceType) {
            resources.push(position);
          }
        }
      }
    }

    return resources;
  }

  private async gatherResource(block: Block): Promise<boolean> {
    try {
      await this.mineflayerBot.dig(block);
      this.gatheredCount++;
      await this.updateMLState();
      return true;
    } catch (error) {
      logger.error('Failed to gather resource', { error });
      return false;
    }
  }

  async validateTask(): Promise<void> {
    await super.validateTask();
    
    if (!this.resourceType) {
      throw new Error('Resource type is required');
    }
    
    if (this.quantity && this.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
  }

  async initializeProgress(): Promise<void> {
    await super.initializeProgress();
    this.gatheredCount = 0;
    this.discoveredResources = [];
  }

  async performTask(): Promise<void> {
    await this.initializeMLState();
    await this.ensureTool('axe', this.resourceType);
    
    const resources = await this.findResources();
    if (resources.length === 0) {
      throw new Error(`No ${this.resourceType} found within radius ${this.radius}`);
    }

    for (const position of resources) {
      if (this.isStopped) break;
      
      await this.navigateTo(position);
      const block = this.mineflayerBot.blockAt(position);
      
      if (block && block.name === this.resourceType) {
        const success = await this.gatherResource(block);
        
        if (!success) {
          this.retryCount++;
          if (this.retryCount > this.maxRetries) {
            throw new Error('Failed to gather resource after multiple attempts');
          }
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }
        
        await this.updateProgress((this.gatheredCount / this.quantity) * 100);
      }
    }
  }
} 