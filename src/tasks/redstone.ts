import { BaseTask, TaskOptions } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters } from '../types/task';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Bot as MineflayerBot } from 'mineflayer';
import { Vec3 } from 'vec3';

interface RedstoneDevice {
  type: 'lever' | 'button' | 'pressure_plate' | 'redstone_torch' | 'redstone_block' | 'repeater' | 'comparator';
  position: { x: number; y: number; z: number };
  state?: boolean;
  delay?: number; // For repeaters
  compareMode?: 'subtract' | 'compare'; // For comparators
}

interface RedstoneCircuit {
  devices: RedstoneDevice[];
  connections: Array<{ from: number; to: number }>;
  updateInterval?: number;
}

interface AutomatedFarm {
  cropTypes: string[];
  harvestArea: {
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
  };
  waterSources: Array<{ x: number; y: number; z: number }>;
  redstoneControl?: RedstoneDevice;
  checkInterval: number;
}

export type RedstoneTaskParameters = TaskOptions & {
  action: 'toggle' | 'monitor' | 'manage_farm';
  target?: {
    type: 'lever' | 'button' | 'pressure_plate' | 'redstone_torch' | 'redstone_block' | 'repeater' | 'comparator';
    position: { x: number; y: number; z: number };
    state?: boolean;
  };
  circuit?: {
    devices: Array<{
      type: 'lever' | 'button' | 'pressure_plate' | 'redstone_torch' | 'redstone_block' | 'repeater' | 'comparator';
      position: { x: number; y: number; z: number };
      state?: boolean;
    }>;
    connections: Array<{ from: number; to: number }>;
  };
  farmConfig?: {
    cropTypes: string[];
    radius: number;
    checkInterval: number;
    requiresWater: boolean;
    minWaterBlocks: number;
  };
  farm?: AutomatedFarm;
  duration?: number;
  interval?: number;
};

export class RedstoneTask extends BaseTask {
  protected action: string;
  protected target: RedstoneDevice | undefined;
  protected circuit: RedstoneCircuit | undefined;
  protected farm: AutomatedFarm | undefined;
  protected duration: number;
  protected interval: number;
  protected mineflayerBot: MineflayerBot;
  protected stopRequested: boolean = false;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: RedstoneTaskParameters) {
    super(bot, commandHandler, options);
    this.mineflayerBot = bot.getMineflayerBot();
    this.action = options.action;
    this.target = options.target;
    this.circuit = options.circuit;
    this.farm = options.farm;
    this.duration = options.duration || 1000;
    this.interval = options.interval || 5000;
  }

  public async performTask(): Promise<void> {
    logger.info('Starting redstone task', {
      action: this.action,
      target: this.target,
    });

    try {
      switch (this.action) {
        case 'toggle':
          await this.toggleDevice();
          break;
        case 'monitor':
          await this.monitorCircuit();
          break;
        case 'manage_farm':
          await this.manageFarm();
          break;
        case 'setup_circuit':
          await this.setupCircuit();
          break;
        case 'pulse':
          await this.pulseDevice();
          break;
        default:
          throw new Error(`Unknown redstone action: ${this.action}`);
      }

      await this.updateProgress(100);
      metrics.tasksCompleted.inc({ task_type: 'redstone' });
    } catch (error) {
      await this.handleError(error as Error, {
        category: 'BLOCK_INTERACTION',
        severity: 'HIGH',
        taskId: this.taskId!,
        taskType: 'redstone',
        metadata: {
          action: this.action,
          target: this.target,
        },
      });
      if (!this.shouldRetry()) {
        throw error;
      }
      await this.retry();
    }
  }

  private async toggleDevice(): Promise<void> {
    if (!this.target) {
      throw new Error('Target device is required for toggle action');
    }

    const { x, y, z } = this.target.position;
    const block = this.mineflayerBot.blockAt(new Vec3(x, y, z));

    if (!block) {
      throw new Error(`No block found at position ${x}, ${y}, ${z}`);
    }

    if (this.target.type === 'lever') {
      await this.mineflayerBot.activateBlock(block);
    } else if (this.target.type === 'button' || this.target.type === 'pressure_plate') {
      await this.mineflayerBot.activateBlock(block);
    } else {
      throw new Error(`Cannot toggle device of type ${this.target.type}`);
    }

    logger.info('Device toggled', {
      type: this.target.type,
      position: this.target.position,
    });
  }

  private async monitorCircuit(): Promise<void> {
    if (!this.circuit) {
      throw new Error('Circuit configuration is required for monitor action');
    }

    this.stopRequested = false;
    while (!this.stopRequested) {
      for (const device of this.circuit.devices) {
        const { x, y, z } = device.position;
        const block = this.mineflayerBot.blockAt(new Vec3(x, y, z));
        
        if (!block) continue;

        const powered = this.isBlockPowered(block);
        logger.info('Device state', {
          type: device.type,
          position: device.position,
          powered,
        });

        metrics.redstoneStates.set({
          device_type: device.type,
          position: `${x},${y},${z}`,
        }, powered ? 1 : 0);
      }

      await new Promise(resolve => setTimeout(resolve, this.interval));
    }
  }

  private async manageFarm(): Promise<void> {
    if (!this.farm) {
      throw new Error('Farm configuration is required for manage_farm action');
    }

    this.stopRequested = false;
    while (!this.stopRequested) {
      // Check water sources
      for (const source of this.farm.waterSources) {
        const block = this.mineflayerBot.blockAt(new Vec3(source.x, source.y, source.z));
        if (!block || block.name !== 'water') {
          logger.warn('Water source missing', { position: source });
          // Place water if possible
          const waterBucket = this.mineflayerBot.inventory.items().find(item => item.name === 'water_bucket');
          if (waterBucket) {
            await this.mineflayerBot.equip(waterBucket, 'hand');
            if (block) {
              await this.mineflayerBot.placeBlock(block, new Vec3(0, 1, 0));
            }
          }
        }
      }

      // Check crops
      const { start, end } = this.farm.harvestArea;
      for (let x = start.x; x <= end.x; x++) {
        for (let z = start.z; z <= end.z; z++) {
          const block = this.mineflayerBot.blockAt(new Vec3(x, start.y, z));
          if (!block) continue;

          if (this.farm.cropTypes.includes(block.name)) {
            const metadata = block.metadata;
            if (metadata === 7) { // Fully grown
              await this.harvestAndReplant(block);
            }
          }
        }
      }

      // Toggle redstone control if needed
      if (this.farm?.redstoneControl) {
        await this.toggleDevice();
      }

      await new Promise(resolve => setTimeout(resolve, this.farm?.checkInterval || 1000));
    }
  }

  private async setupCircuit(): Promise<void> {
    if (!this.circuit) {
      throw new Error('Circuit configuration is required for setup action');
    }

    // Place devices
    for (const device of this.circuit.devices) {
      const { x, y, z } = device.position;
      const block = this.mineflayerBot.blockAt(new Vec3(x, y, z));
      
      if (!block || block.name === 'air') {
        const item = this.mineflayerBot.inventory.items().find(item => 
          item.name === device.type || 
          item.name === `${device.type}_block`
        );

        if (!item) {
          throw new Error(`No ${device.type} found in inventory`);
        }

        await this.mineflayerBot.equip(item, 'hand');
        if (block) {
          await this.mineflayerBot.placeBlock(block, new Vec3(0, 1, 0));

          // Configure device if needed
          if (device.type === 'repeater' && device.delay) {
            for (let i = 1; i < device.delay; i++) {
              if (block) {
                await this.mineflayerBot.activateBlock(block);
              }
            }
          } else if (device.type === 'comparator' && device.compareMode) {
            if (device.compareMode === 'subtract' && block) {
              await this.mineflayerBot.activateBlock(block);
            }
          }
        }
      }
    }

    // Place redstone dust for connections
    for (const connection of this.circuit.connections) {
      const from = this.circuit.devices[connection.from];
      const to = this.circuit.devices[connection.to];
      await this.connectDevices(from, to);
    }
  }

  private async pulseDevice(): Promise<void> {
    if (!this.target) {
      throw new Error('Target device is required for pulse action');
    }

    await this.toggleDevice();
    await new Promise(resolve => setTimeout(resolve, this.duration));
    await this.toggleDevice();
  }

  private async harvestAndReplant(block: any): Promise<void> {
    await this.mineflayerBot.dig(block);
    
    const seed = this.mineflayerBot.inventory.items().find(item => 
      item.name === `${block.name}_seeds` || 
      item.name === block.name
    );

    if (seed) {
      await this.mineflayerBot.equip(seed, 'hand');
      await this.mineflayerBot.placeBlock(block, new Vec3(0, 1, 0));
    }
  }

  private async connectDevices(from: RedstoneDevice, to: RedstoneDevice): Promise<void> {
    // Calculate path points between devices
    const points = this.calculateRedstonePath(from.position, to.position);

    // Place redstone dust along the path
    for (const point of points) {
      const block = this.mineflayerBot.blockAt(new Vec3(point.x, point.y, point.z));
      if (!block || block.name === 'air') {
        const redstoneDust = this.mineflayerBot.inventory.items().find(item => 
          item.name === 'redstone'
        );

        if (!redstoneDust) {
          throw new Error('No redstone dust found in inventory');
        }

        await this.mineflayerBot.equip(redstoneDust, 'hand');
        if (block) {
          await this.mineflayerBot.placeBlock(block, new Vec3(0, 1, 0));
        }
      }
    }
  }

  private calculateRedstonePath(from: { x: number; y: number; z: number }, 
                              to: { x: number; y: number; z: number }): Array<{ x: number; y: number; z: number }> {
    const points: Array<{ x: number; y: number; z: number }> = [];
    const dx = to.x - from.x;
    const dz = to.z - from.z;

    // Simple L-shaped path
    for (let x = 0; x <= Math.abs(dx); x++) {
      points.push({
        x: from.x + (dx > 0 ? x : -x),
        y: from.y,
        z: from.z,
      });
    }

    const lastX = points[points.length - 1].x;
    for (let z = 0; z <= Math.abs(dz); z++) {
      points.push({
        x: lastX,
        y: from.y,
        z: from.z + (dz > 0 ? z : -z),
      });
    }

    return points;
  }

  private isBlockPowered(block: any): boolean {
    // Check if the block is a redstone component and is powered
    if (block.name.includes('redstone')) {
      return block.metadata > 0;
    }
    
    // For other blocks, check if they're receiving redstone power
    const neighbors = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 }
    ];

    for (const offset of neighbors) {
      const neighborPos = block.position.offset(offset.x, offset.y, offset.z);
      const neighbor = this.mineflayerBot.world.getBlock(neighborPos);
      if (neighbor && neighbor.name.includes('redstone') && neighbor.metadata > 0) {
        return true;
      }
    }

    return false;
  }

  public stop(): void {
    this.stopRequested = true;
  }
} 