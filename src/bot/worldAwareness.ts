import { Bot as MineflayerBot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Block } from 'prismarine-block';
import { MinecraftBot } from './bot';
import { Biome } from 'prismarine-biome';

interface WorldMap {
  blocks: Map<string, Block>;
  biomes: Map<string, Biome>;
  resources: Map<string, Vec3[]>;
  lastUpdated: number;
}

interface ResourceTracker {
  type: string;
  locations: Vec3[];
  lastSeen: number;
  estimatedQuantity: number;
}

export class WorldAwareness {
  private bot: MinecraftBot;
  private mineflayerBot: MineflayerBot;
  private worldMap: WorldMap;
  private resourceTrackers: Map<string, ResourceTracker>;
  private updateInterval: number;
  private scanRadius: number;

  constructor(bot: MinecraftBot, config: { updateInterval?: number; scanRadius?: number } = {}) {
    this.bot = bot;
    this.mineflayerBot = bot.getMineflayerBot();
    this.worldMap = {
      blocks: new Map(),
      biomes: new Map(),
      resources: new Map(),
      lastUpdated: Date.now()
    };
    this.resourceTrackers = new Map();
    this.updateInterval = config.updateInterval || 5000; // 5 seconds
    this.scanRadius = config.scanRadius || 32; // 32 blocks

    this.initialize();
  }

  private initialize() {
    // Set up event listeners
    this.mineflayerBot.on('chunkColumnLoad', this.handleChunkLoad.bind(this));
    this.mineflayerBot.on('blockUpdate', this.handleBlockUpdate.bind(this));
    this.mineflayerBot.on('entitySpawn', this.handleEntitySpawn.bind(this));
    this.mineflayerBot.on('entityGone', this.handleEntityGone.bind(this));

    // Start periodic updates
    setInterval(() => this.updateWorldMap(), this.updateInterval);
  }

  private handleChunkLoad(chunk: any) {
    // Update world map with new chunk data
    for (const block of chunk.blocks) {
      const key = this.getBlockKey(block.position);
      this.worldMap.blocks.set(key, block);
      
      // Track resources
      if (this.isResource(block)) {
        this.trackResource(block);
      }
    }
  }

  private handleBlockUpdate(oldBlock: Block | null, newBlock: Block) {
    if (!oldBlock) {
      return;
    }

    const key = this.getBlockKey(newBlock.position);
    this.worldMap.blocks.set(key, newBlock);

    // Update resource tracking
    if (this.isResource(newBlock)) {
      this.trackResource(newBlock);
    } else if (this.isResource(oldBlock)) {
      this.untrackResource(oldBlock);
    }
  }

  private handleEntitySpawn(entity: any) {
    // Track entities that might be resources (e.g., animals, mobs)
    if (this.isResourceEntity(entity)) {
      this.trackResourceEntity(entity);
    }
  }

  private handleEntityGone(entity: any) {
    // Remove tracked entities
    if (this.isResourceEntity(entity)) {
      this.untrackResourceEntity(entity);
    }
  }

  private getBlockKey(position: Vec3): string {
    return `${position.x},${position.y},${position.z}`;
  }

  private isResource(block: Block): boolean {
    const resourceTypes = [
      'diamond_ore', 'iron_ore', 'gold_ore', 'coal_ore',
      'redstone_ore', 'lapis_ore', 'emerald_ore',
      'ancient_debris', 'nether_gold_ore', 'nether_quartz_ore'
    ];
    return resourceTypes.includes(block.name);
  }

  private isResourceEntity(entity: any): boolean {
    const resourceEntities = [
      'cow', 'sheep', 'pig', 'chicken',
      'villager', 'wandering_trader'
    ];
    return resourceEntities.includes(entity.name);
  }

  private trackResource(block: Block) {
    const type = block.name;
    if (!this.resourceTrackers.has(type)) {
      this.resourceTrackers.set(type, {
        type,
        locations: [],
        lastSeen: Date.now(),
        estimatedQuantity: 0
      });
    }

    const tracker = this.resourceTrackers.get(type)!;
    tracker.locations.push(block.position);
    tracker.lastSeen = Date.now();
    tracker.estimatedQuantity++;
  }

  private untrackResource(block: Block) {
    const type = block.name;
    const tracker = this.resourceTrackers.get(type);
    if (tracker) {
      tracker.locations = tracker.locations.filter(
        loc => !loc.equals(block.position)
      );
      tracker.estimatedQuantity--;
    }
  }

  private trackResourceEntity(entity: any) {
    const type = entity.name;
    if (!this.resourceTrackers.has(type)) {
      this.resourceTrackers.set(type, {
        type,
        locations: [],
        lastSeen: Date.now(),
        estimatedQuantity: 0
      });
    }

    const tracker = this.resourceTrackers.get(type)!;
    tracker.locations.push(entity.position);
    tracker.lastSeen = Date.now();
    tracker.estimatedQuantity++;
  }

  private untrackResourceEntity(entity: any) {
    const type = entity.name;
    const tracker = this.resourceTrackers.get(type);
    if (tracker) {
      tracker.locations = tracker.locations.filter(
        loc => !loc.equals(entity.position)
      );
      tracker.estimatedQuantity--;
    }
  }

  private async updateWorldMap() {
    const botPosition = this.bot.getMineflayerBot().entity.position;
    
    // Scan surrounding area
    for (let x = -this.scanRadius; x <= this.scanRadius; x++) {
      for (let y = -this.scanRadius; y <= this.scanRadius; y++) {
        for (let z = -this.scanRadius; z <= this.scanRadius; z++) {
          const position = botPosition.offset(x, y, z);
          const block = this.mineflayerBot.blockAt(position);
          
          if (block) {
            const key = this.getBlockKey(position);
            this.worldMap.blocks.set(key, block);
            
            if (this.isResource(block)) {
              this.trackResource(block);
            }
          }
        }
      }
    }

    this.worldMap.lastUpdated = Date.now();
  }

  public getResourceLocations(type: string): Vec3[] {
    const tracker = this.resourceTrackers.get(type);
    return tracker ? tracker.locations : [];
  }

  public getResourceCount(type: string): number {
    const tracker = this.resourceTrackers.get(type);
    return tracker ? tracker.estimatedQuantity : 0;
  }

  public getNearestResource(type: string, position: Vec3): Vec3 | null {
    const locations = this.getResourceLocations(type);
    if (locations.length === 0) return null;

    return locations.reduce((nearest, current) => {
      const nearestDist = nearest.distanceTo(position);
      const currentDist = current.distanceTo(position);
      return currentDist < nearestDist ? current : nearest;
    });
  }

  public getBiomeAt(position: Vec3): string | null {
    const key = this.getBlockKey(position);
    const biome = this.worldMap.biomes.get(key);
    return biome ? biome.name : null;
  }

  public getBiomeData(position: Vec3): Biome | null {
    const key = this.getBlockKey(position);
    return this.worldMap.biomes.get(key) || null;
  }

  public getBlockAt(position: Vec3): Block | null {
    const key = this.getBlockKey(position);
    return this.worldMap.blocks.get(key) || null;
  }

  public getLastUpdateTime(): number {
    return this.worldMap.lastUpdated;
  }
} 