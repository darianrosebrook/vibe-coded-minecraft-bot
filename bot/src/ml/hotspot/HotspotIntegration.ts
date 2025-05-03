import { MinecraftBot } from '../../bot/bot';
import { HotspotTracker } from './HotspotTracker';
import { Vec3 } from 'vec3';
import { Block } from 'prismarine-block';

export class HotspotIntegration {
  private tracker: HotspotTracker;
  private bot: MinecraftBot;

  constructor(bot: MinecraftBot) {
    this.bot = bot;
    this.tracker = new HotspotTracker();

    // Listen for block events
    this.bot.on('blockBreakProgressEnd', (block: Block) => {
      if (this.isValuableResource(block)) {
        const yieldValue = this.calculateYield(block);
        this.tracker.recordResource(block.position, block.name, yieldValue);
      }
    });

    this.bot.on('blockUpdate', (oldBlock: Block | null, newBlock: Block) => {
      if (this.isFarmableBlock(newBlock)) {
        this.tracker.recordResource(newBlock.position, newBlock.name, 1);
      }
    });
  }

  public getBestResourceLocation(resourceType: string): Vec3 | null {
    const hotspot = this.tracker.getBestHotspot(resourceType);
    if (!hotspot) return null;

    // Add some randomness to the position to avoid always mining in the exact same spot
    const randomOffset = new Vec3(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    );

    return hotspot.position.plus(randomOffset);
  }

  public getResourceHotspots(resourceType: string): Array<{
    position: Vec3;
    confidence: number;
  }> {
    const hotspots = this.tracker.getBestHotspot(resourceType);
    if (!hotspots) return [];

    return [{
      position: hotspots.position,
      confidence: hotspots.confidence
    }];
  }

  private isValuableResource(block: Block): boolean {
    const valuableBlocks = [
      'diamond_ore',
      'iron_ore',
      'gold_ore',
      'coal_ore',
      'redstone_ore',
      'lapis_ore',
      'emerald_ore',
      'ancient_debris'
    ];
    return valuableBlocks.includes(block.name);
  }

  private isFarmableBlock(block: Block): boolean {
    const farmableBlocks = [
      'wheat',
      'carrots',
      'potatoes',
      'beetroot',
      'pumpkin',
      'melon'
    ];
    return farmableBlocks.includes(block.name);
  }

  private calculateYield(block: Block): number {
    const yieldMap: Record<string, number> = {
      'diamond_ore': 1,
      'iron_ore': 1,
      'redstone_ore': 4,
      'lapis_ore': 4,
      'wheat': 1
    };
    return yieldMap[block.name] || 0;
  }
} 