import { Bot as MineflayerBot } from 'mineflayer';
import { Vec3 } from 'vec3';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { MinecraftBot } from './bot';
import { BiomeData, BlockState, ChunkColumn } from '../types/world';
import type { Block } from 'prismarine-block';
import { default as createBiome } from 'prismarine-biome';
import { LRUCache } from 'lru-cache';
import { MLStateFactory } from '../ml/state/factory';
import type { PCChunk } from 'prismarine-chunk';
import { Registry } from 'prismarine-registry';

// Chunk processing configuration
const CHUNK_PROCESSING_CONFIG = {
  logLevel: 'debug' as 'debug' | 'info',
  batchSize: 10000, // Number of blocks to process before logging progress
  valuableBlocks: [
    'diamond_ore',
    'emerald_ore',
    'gold_ore',
    'iron_ore',
    'coal_ore',
    'lapis_ore',
    'redstone_ore',
    'ancient_debris'
  ]
};

// Batched logging helper
class BatchedLogger {
  private static batchedMessages: Map<string, { count: number; level: 'debug' | 'info' }> = new Map();
  private static batchTimeout: NodeJS.Timeout | null = null;
  private static readonly FLUSH_INTERVAL = 20000; // Reduced from 5s to 2s for more frequent updates
  private static readonly MAX_BATCH_SIZE = 50; // Maximum number of unique messages to batch

  static log(message: string, level: 'debug' | 'info' = 'info', count: number = 1) {
    const key = `${level}:${message}`;
    const current = this.batchedMessages.get(key) || { count: 0, level };
    this.batchedMessages.set(key, { count: current.count + count, level });

    // Force flush if we have too many unique messages
    if (this.batchedMessages.size >= this.MAX_BATCH_SIZE) {
      this.flush(true);
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
    }
  }

  static flush(force: boolean = false) {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Group messages by type (chunk load vs processing)
    const groupedMessages = new Map<string, { count: number; level: 'debug' | 'info' }>();
    
    for (const [key, { count, level }] of this.batchedMessages.entries()) {
      const message = key.split(':').slice(1).join(':');
      const isChunkLoad = message.includes('Chunk loaded at');
      const isProcessing = message.includes('Starting to process chunk');
      const isProgress = message.includes('Processed');
      
      let groupKey = 'other';
      if (isChunkLoad) groupKey = 'chunk_load';
      else if (isProcessing) groupKey = 'chunk_process';
      else if (isProgress) groupKey = 'progress';
      
      const current = groupedMessages.get(groupKey) || { count: 0, level };
      groupedMessages.set(groupKey, { count: current.count + count, level });
    }

    // Log grouped messages
    for (const [group, { count, level }] of groupedMessages.entries()) {
      let message = '';
      switch (group) {
        case 'chunk_load':
          message = `Loaded ${count} chunks`;
          break;
        case 'chunk_process':
          message = `Processing ${count} chunks`;
          break;
        case 'progress':
          message = `Progress updates for ${count} chunks`;
          break;
        default:
          message = `Other operations: ${count}`;
      }
      logger[level](message);
    }

    this.batchedMessages.clear();
  }
}

// types

export class WorldTracker {
  private bot: MinecraftBot;
  private mineflayerBot: MineflayerBot | null = null;
  private knownBlocks: Map<string, Set<string>>; // biome -> block types
  private resourceLocations: Map<string, Vec3[]>; // block type -> positions
  private lastScanTime: number = 0;
  private scanInterval: number = 5000; // 5 seconds
  private biome: any | null = null; // prismarine-biome instance
  private registry: Registry | null = null;
  private resourceCache: LRUCache<string, Vec3>;
  private biomeCache: LRUCache<string, string>;
  private blockCache: LRUCache<string, string[]>;
  private scanDebounces: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized: boolean = false;

  constructor(bot: MinecraftBot) {
    this.bot = bot;
    this.knownBlocks = MLStateFactory.createBiomeBlocksMap();
    this.resourceLocations = MLStateFactory.createResourceMap([
      'diamond_ore',
      'emerald_ore',
      'gold_ore',
      'iron_ore',
      'coal_ore',
      'lapis_ore',
      'redstone_ore',
      'ancient_debris'
    ]);
    
    // Initialize caches
    const cacheOptions = {
      max: 1000,
      ttl: 60000, // 1 minute
      updateAgeOnGet: true,
      updateAgeOnHas: true
    };
    this.resourceCache = new LRUCache(cacheOptions);
    this.biomeCache = new LRUCache(cacheOptions);
    this.blockCache = new LRUCache(cacheOptions);
  }

  public initialize(mineflayerBot: MineflayerBot): void {
    this.mineflayerBot = mineflayerBot;
    try {
      // Initialize registry with the bot's version
      const registry = require('prismarine-registry')(mineflayerBot.version);
      this.registry = registry;
      this.biome = createBiome(registry);
      
      if (!this.biome) {
        throw new Error('Failed to create biome instance');
      }
      this.setupEventListeners();
      this.isInitialized = true;
      logger.info('WorldTracker initialized');
    } catch (error) {
      logger.error('Failed to initialize WorldTracker:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.mineflayerBot) return;

    this.mineflayerBot.on('chunkColumnLoad', (position: Vec3) => {
      const chunkX = position.x >> 4;
      const chunkZ = position.z >> 4;
      const worldChunkX = chunkX * 16;
      const worldChunkZ = chunkZ * 16;
      
      // Batch both the chunk load and processing messages
      BatchedLogger.log(`Chunk loaded at (${chunkX}, ${chunkZ})`, 'info');
      BatchedLogger.log(`Starting to process chunk at (${worldChunkX}, ${worldChunkZ})`, 'info');
      
      this.processChunkData(chunkX, chunkZ);
    });
  }

  private processChunkData(chunkX: number, chunkZ: number): Vec3[] {
    if (!this.mineflayerBot || !this.isInitialized) {
      logger.warn('Attempted to process chunk data before initialization');
      return [];
    }

    const blockPositions: Vec3[] = [];
    const worldChunkX = chunkX * 16;
    const worldChunkZ = chunkZ * 16;
    let processedBlocks = 0;
    const totalBlocks = 16 * 16 * 256; // Total blocks in a chunk
    
    // Process each block in the chunk
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 256; y++) {
          processedBlocks++;
          if (processedBlocks % 10000 === 0) {
            BatchedLogger.log(`Processed ${processedBlocks}/${totalBlocks} blocks (${Math.round((processedBlocks / totalBlocks) * 100)}%) in chunk (${chunkX}, ${chunkZ})`, 'debug');
          }
          
          const block = this.mineflayerBot.world.getBlock(new Vec3(worldChunkX + x, y, worldChunkZ + z));
          if (block) {
            this.processBlock(block, new Vec3(worldChunkX + x, y, worldChunkZ + z));
            blockPositions.push(new Vec3(worldChunkX + x, y, worldChunkZ + z));
          }
        }
      }
    }
    
    return blockPositions;
  }

  private processBlock(block: Block, position: Vec3): void {
    if (!this.mineflayerBot || !this.biome || !this.registry) {
      logger.warn('Attempted to process block before initialization');
      return;
    }

    try {
      const biomeId = this.mineflayerBot.world.getBiome(position);
      if (biomeId === undefined) {
        logger.warn(`Could not get biome ID at position ${position}`);
        return;
      }

      // Get biome name from the biome registry
      let biomeName = 'unknown';
      try {
        const biomeData = this.registry.biomesByName[biomeId];
        biomeName = biomeData?.name || `biome_${biomeId}`;
      } catch (error) {
        logger.warn(`Could not get biome name for ID ${biomeId}, using fallback name`);
        biomeName = `biome_${biomeId}`;
      }
      
      // Update known blocks for this biome
      if (!this.knownBlocks.has(biomeName)) {
        this.knownBlocks.set(biomeName, new Set());
      }
      this.knownBlocks.get(biomeName)?.add(block.name);

      // Track resource locations for valuable blocks
      if (this.isValuableBlock(block.name)) {
        if (!this.resourceLocations.has(block.name)) {
          this.resourceLocations.set(block.name, []);
        }
        this.resourceLocations.get(block.name)?.push(position);
        
        // Update metrics and logging
        metrics.blocksMined.inc({
          block_type: block.name
        });
        logger.debug(`Found valuable block: ${block.name} at ${position} in biome ${biomeName}`);
      }
    } catch (error) {
      logger.error('Error processing block:', error);
      metrics.botErrors.inc({ type: 'block_processing' });
    }
  }

  private isValuableBlock(blockName: string): boolean {
    return [
      'diamond_ore',
      'emerald_ore',
      'gold_ore',
      'iron_ore',
      'coal_ore',
      'lapis_ore',
      'redstone_ore',
      'ancient_debris'
    ].includes(blockName);
  }

  public getKnownBlocks(biome: string): string[] {
    const cacheKey = `blocks:${biome}`;
    const cached = this.blockCache.get(cacheKey);
    if (cached) return cached;

    const result = Array.from(this.knownBlocks.get(biome) || new Set()) as string[];
    if (result.length > 0) {
      this.blockCache.set(cacheKey, result);
    }
    return result;
  }

  public getResourceLocations(blockType: string): Vec3[] {
    return this.resourceLocations.get(blockType) || [];
  }

  public findNearestResource(blockType: string): Vec3 | null {
    if (!this.mineflayerBot || !this.mineflayerBot.entity) return null;

    const locations = this.getResourceLocations(blockType);
    if (locations.length === 0) return null;

    const botPosition = this.mineflayerBot.entity.position;
    return locations.reduce((nearest, current) => {
      const nearestDist = nearest ? nearest.distanceTo(botPosition) : Infinity;
      const currentDist = current.distanceTo(botPosition);
      return currentDist < nearestDist ? current : nearest;
    });
  }

  public getBiomeAt(position: Vec3): string | null {
    if (!this.mineflayerBot || !this.biome) return null;

    const cacheKey = `biome:${position.x},${position.y},${position.z}`;
    const cached = this.biomeCache.get(cacheKey);
    if (cached) return cached;

    const biomeId = this.mineflayerBot.world.getBiome(position);
    const result = this.biome.biomes[biomeId]?.name || null;
    if (result) {
      this.biomeCache.set(cacheKey, result);
    }
    return result;
  }

  public async findResource(blockType: string): Promise<Vec3 | null> {
    const cacheKey = `resource:${blockType}`;
    const cached = this.resourceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const key = `scan:${blockType}`;
    if (!this.scanDebounces.has(key)) {
      const result = await this.findNearestResource(blockType);
      if (result) {
        this.resourceCache.set(cacheKey, result);
      }
      return result;
    }

    return new Promise<Vec3 | null>(resolve => {
      this.scanDebounces.set(key, setTimeout(async () => {
        this.scanDebounces.delete(key);
        const result = await this.findNearestResource(blockType);
        if (result) {
          this.resourceCache.set(cacheKey, result);
        }
        resolve(result);
      }, 1000)); // 1 second debounce
    });
  }

  public clearCaches(): void {
    this.resourceCache.clear();
    this.biomeCache.clear();
    this.blockCache.clear();
    this.scanDebounces.clear();
  }
}