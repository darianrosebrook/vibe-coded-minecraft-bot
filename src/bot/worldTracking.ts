import { Bot as MineflayerBot } from 'mineflayer';
import { Vec3 } from 'vec3';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { MinecraftBot } from './bot';
import prismarineBiome from 'prismarine-biome';

export class WorldTracker {
  private bot: MinecraftBot;
  private mineflayerBot: MineflayerBot;
  private knownBlocks: Map<string, Set<string>>; // biome -> block types
  private resourceLocations: Map<string, Vec3[]>; // block type -> positions
  private lastScanTime: number = 0;
  private scanInterval: number = 5000; // 5 seconds
  private Biome: any;

  constructor(bot: MinecraftBot) {
    this.bot = bot;
    this.mineflayerBot = bot.getMineflayerBot();
    this.knownBlocks = new Map();
    this.resourceLocations = new Map();
    this.Biome = prismarineBiome(this.mineflayerBot.version);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Track block updates
    this.mineflayerBot.on('blockUpdate', (oldBlock, newBlock) => {
      if (!oldBlock) {
        logger.warn('Received block update with null oldBlock');
        return;
      }
      const position = oldBlock.position;
      this.updateBlockTracking(position, newBlock);
    });

    // Track chunk loads
    this.mineflayerBot.on('chunkColumnLoad', (chunk) => {
      this.scanChunk(chunk);
    });

    // Periodic resource scan
    setInterval(() => {
      this.scanNearbyResources();
    }, this.scanInterval);
  }

  private updateBlockTracking(position: Vec3, block: any) {
    const biomeId = this.mineflayerBot.world.getBiome(position);
    const biome = new this.Biome(biomeId);
    const biomeName = biome.name;
    const blockType = block.name;

    // Update known blocks for this biome
    if (!this.knownBlocks.has(biomeName)) {
      this.knownBlocks.set(biomeName, new Set());
    }
    this.knownBlocks.get(biomeName)?.add(blockType);

    // Update resource locations
    if (this.isResourceBlock(blockType)) {
      if (!this.resourceLocations.has(blockType)) {
        this.resourceLocations.set(blockType, []);
      }
      const locations = this.resourceLocations.get(blockType)!;
      locations.push(position.clone());

      // Update metrics
      metrics.blocksMined.inc({ block_type: blockType });
    }
  }

  private scanChunk(chunk: any) {
    const now = Date.now();
    if (now - this.lastScanTime < this.scanInterval) return;
    this.lastScanTime = now;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 256; y++) {
          const position = new Vec3(
            chunk.x * 16 + x,
            y,
            chunk.z * 16 + z
          );
          const block = this.mineflayerBot.world.getBlock(position);
          if (block && this.isResourceBlock(block.name)) {
            this.updateBlockTracking(position, block);
          }
        }
      }
    }
  }

  private scanNearbyResources() {
    if (!this.mineflayerBot.entity) {
      logger.warn('Bot not fully connected, skipping resource scan');
      return;
    }

    const radius = 32; // Scan radius in blocks
    const center = this.mineflayerBot.entity.position;

    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
          const position = center.offset(x, y, z);
          const block = this.bot.getMineflayerBot().world.getBlock(position);
          if (block && this.isResourceBlock(block.name)) {
            this.updateBlockTracking(position, block);
          }
        }
      }
    }
  }

  private isResourceBlock(blockType: string): boolean {
    // Define what counts as a resource block
    const resourceBlocks = new Set([
      'coal_ore',
      'iron_ore',
      'gold_ore',
      'diamond_ore',
      'emerald_ore',
      'redstone_ore',
      'lapis_ore',
      'ancient_debris',
      'nether_gold_ore',
      'nether_quartz_ore',
    ]);
    return resourceBlocks.has(blockType);
  }

  // Public API
  public getKnownBlocks(biome: string): string[] {
    return Array.from(this.knownBlocks.get(biome) || []);
  }

  public getResourceLocations(blockType: string): Vec3[] {
    return this.resourceLocations.get(blockType) || [];
  }

  public findNearestResource(blockType: string): Vec3 | null {
    const locations = this.getResourceLocations(blockType);
    if (locations.length === 0) return null;

    let nearest = locations[0];
    let minDistance = this.bot.getMineflayerBot().entity.position.distanceTo(nearest);

    for (const location of locations) {
      const distance = this.bot.getMineflayerBot().entity.position.distanceTo(location);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = location;
      }
    }

    return nearest;
  }

  public getBiomeAt(position: Vec3): string {
    const biomeId = this.mineflayerBot.world.getBiome(position);
    const biome = new this.Biome(biomeId);
    return biome.name;
  }

  public getBiomeData(position: Vec3): any {
    const biomeId = this.mineflayerBot.world.getBiome(position);
    return new this.Biome(biomeId);
  }
} 