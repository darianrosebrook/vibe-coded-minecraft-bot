import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Tool } from 'mineflayer-tool';
import { PVP } from 'mineflayer-pvp';
import { CollectBlock } from 'mineflayer-collectblock';
import { AutoEat } from 'mineflayer-auto-eat';
import { Pathfinder } from 'mineflayer-pathfinder';

export interface BotStateSource {
  /** Get current bot position */
  getPosition(): Vec3;
  /** Get current health level */
  getHealth(): number;
  /** Get current food level */
  getFood(): number;
  /** Get current inventory state */
  getInventory(): {
    items: Array<{ name: string; count: number }>;
    emptySlots: number;
    totalSlots: number;
  };
  /** Get current movement state */
  getMovement(): {
    velocity: Vec3;
    yaw: number;
    pitch: number;
    control: {
      sprint: boolean;
      sneak: boolean;
    };
  };
}

export interface WorldStateSource {
  /** Get biome at position */
  getBiome(position: Vec3): { name: string; temperature: number; rainfall: number };
  /** Get time of day */
  getTimeOfDay(): number;
  /** Check if it's raining */
  isRaining(): boolean;
  /** Get nearby blocks */
  getNearbyBlocks(position: Vec3, radius: number): Array<{ type: string; position: Vec3 }>;
  /** Get nearby entities */
  getNearbyEntities(position: Vec3, radius: number): Array<{ type: string; position: Vec3; distance: number }>;
}

export interface ToolStateSource {
  /** Get current tool in hand */
  getCurrentTool(): { type: string; durability: number } | null;
  /** Get best tool for block type */
  getBestTool(blockType: string): { type: string; durability: number } | null;
  /** Get tool effectiveness */
  getToolEffectiveness(toolType: string, blockType: string): number;
}

export interface CombatStateSource {
  /** Get current combat state */
  getCombatState(): {
    inCombat: boolean;
    target: { type: string; position: Vec3; distance: number } | null;
    damageDealt: number;
    damageTaken: number;
  };
  /** Get nearby hostile entities */
  getHostileEntities(radius: number): Array<{ type: string; position: Vec3; distance: number; health: number }>;
}

export interface TaskStateSource {
  /** Get current task state */
  getCurrentTask(): {
    type: string;
    status: 'running' | 'completed' | 'failed';
    startTime: number;
    endTime?: number;
    resourcesUsed: Map<string, number>;
  } | null;
  /** Get recent task history */
  getTaskHistory(limit: number): Array<{
    type: string;
    status: 'success' | 'failure' | 'in_progress';
    startTime: number;
    endTime: number;
    resourcesUsed: Map<string, number>;
    executionTime: number;
  }>;
}

export class MLStateDataSources {
  private bot: Bot;
  private toolPlugin: Tool;
  private pvpPlugin: PVP;
  private collectBlockPlugin: CollectBlock;
  private autoEatPlugin: AutoEat;
  private pathfinderPlugin: Pathfinder;

  constructor(bot: Bot) {
    this.bot = bot;
    this.toolPlugin = bot.tool;
    this.pvpPlugin = bot.pvp;
    this.collectBlockPlugin = bot.collectBlock;
    this.autoEatPlugin = bot.autoEat;
    this.pathfinderPlugin = bot.pathfinder;
  }

  public getBotState(): BotStateSource {
    return {
      getPosition: () => this.bot.entity.position,
      getHealth: () => this.bot.health,
      getFood: () => this.bot.food,
      getInventory: () => ({
        items: this.bot.inventory.items().map(item => ({
          name: item.name,
          count: item.count
        })),
        emptySlots: this.bot.inventory.emptySlots(),
        totalSlots: this.bot.inventory.slots.length
      }),
      getMovement: () => ({
        velocity: this.bot.entity.velocity,
        yaw: this.bot.entity.yaw,
        pitch: this.bot.entity.pitch,
        control: {
          sprint: this.bot.controlState.sprint,
          sneak: this.bot.controlState.sneak
        }
      })
    };
  }

  public getWorldState(): WorldStateSource {
    return {
      getBiome: (position: Vec3) => {
        const biome = this.bot.biomeAt(position);
        return {
          name: biome.name,
          temperature: biome.temperature,
          rainfall: biome.rainfall
        };
      },
      getTimeOfDay: () => this.bot.time.timeOfDay,
      isRaining: () => this.bot.isRaining,
      getNearbyBlocks: (position: Vec3, radius: number) => {
        return this.bot.findBlocks({
          maxDistance: radius,
          count: 100,
          matching: () => true
        }).map(block => ({
          type: this.bot.blockAt(block)?.name || 'unknown',
          position: block
        }));
      },
      getNearbyEntities: (position: Vec3, radius: number) => {
        return Object.values(this.bot.entities)
          .filter(entity => entity.position.distanceTo(position) <= radius)
          .map(entity => ({
            type: entity.type,
            position: entity.position,
            distance: entity.position.distanceTo(position)
          }));
      }
    };
  }

  public getToolState(): ToolStateSource {
    return {
      getCurrentTool: () => {
        const item = this.bot.heldItem;
        if (!item) return null;
        return {
          type: item.name,
          durability: item.durability
        };
      },
      getBestTool: (blockType: string) => {
        const tool = this.toolPlugin.bestTool(this.bot.blockAt(this.bot.entity.position));
        if (!tool) return null;
        return {
          type: tool.name,
          durability: tool.durability
        };
      },
      getToolEffectiveness: (toolType: string, blockType: string) => {
        // TODO: Implement tool effectiveness calculation
        return 1.0;
      }
    };
  }

  public getCombatState(): CombatStateSource {
    return {
      getCombatState: () => ({
        inCombat: this.pvpPlugin.target !== null,
        target: this.pvpPlugin.target ? {
          type: this.pvpPlugin.target.type,
          position: this.pvpPlugin.target.position,
          distance: this.pvpPlugin.target.position.distanceTo(this.bot.entity.position)
        } : null,
        damageDealt: 0, // TODO: Track damage dealt
        damageTaken: 0 // TODO: Track damage taken
      }),
      getHostileEntities: (radius: number) => {
        return Object.values(this.bot.entities)
          .filter(entity => entity.type === 'mob' && entity.position.distanceTo(this.bot.entity.position) <= radius)
          .map(entity => ({
            type: entity.type,
            position: entity.position,
            distance: entity.position.distanceTo(this.bot.entity.position),
            health: entity.health || 0
          }));
      }
    };
  }

  public getTaskState(): TaskStateSource {
    return {
      getCurrentTask: () => {
        // TODO: Implement current task tracking
        return null;
      },
      getTaskHistory: (limit: number) => {
        // TODO: Implement task history tracking
        return [];
      }
    };
  }
} 