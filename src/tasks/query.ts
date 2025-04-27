import { BaseTask } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, QueryTaskParameters } from '../types/task';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Bot as MineflayerBot } from 'mineflayer';
import { Biome } from 'prismarine-biome';

// Biome metadata for enhanced descriptions
const BIOME_METADATA: Record<string, { description: string; features: string[] }> = {
  'plains': {
    description: 'a vast, flat grassland',
    features: ['grass', 'flowers', 'tall grass']
  },
  'forest': {
    description: 'a dense woodland',
    features: ['trees', 'ferns', 'mushrooms']
  },
  'taiga': {
    description: 'a cold, coniferous forest',
    features: ['spruce trees', 'ferns', 'sweet berry bushes']
  },
  'desert': {
    description: 'a hot, arid landscape',
    features: ['sand', 'cacti', 'dead bushes']
  },
  'swamp': {
    description: 'a murky wetland',
    features: ['water', 'lily pads', 'vines']
  },
  'jungle': {
    description: 'a lush, tropical rainforest',
    features: ['tall trees', 'vines', 'bamboo']
  },
  'savanna': {
    description: 'a warm, grassy plain',
    features: ['acacia trees', 'tall grass', 'flowers']
  },
  'badlands': {
    description: 'a colorful, arid plateau',
    features: ['terracotta', 'red sand', 'dead bushes']
  },
  'ocean': {
    description: 'a vast body of water',
    features: ['water', 'kelp', 'seagrass']
  },
  'river': {
    description: 'a flowing waterway',
    features: ['water', 'sand', 'clay']
  },
  'mountains': {
    description: 'a rugged mountainous region',
    features: ['stone', 'gravel', 'coal ore']
  },
  'gravelly_mountains': {
    description: 'a mountainous area with gravel',
    features: ['gravel', 'stone', 'coal ore']
  },
  'wooded_mountains': {
    description: 'a forested mountainous region',
    features: ['trees', 'stone', 'coal ore']
  },
  'taiga_mountains': {
    description: 'a cold mountainous taiga',
    features: ['spruce trees', 'stone', 'coal ore']
  },
  'snowy_mountains': {
    description: 'a snow-covered mountain range',
    features: ['snow', 'ice', 'stone']
  },
  'snowy_tundra': {
    description: 'a frozen plain',
    features: ['snow', 'ice', 'spruce trees']
  },
  'snowy_taiga': {
    description: 'a cold forest covered in snow',
    features: ['snow', 'spruce trees', 'sweet berry bushes']
  },
  'ice_spikes': {
    description: 'a frozen landscape with ice spikes',
    features: ['ice spikes', 'snow', 'packed ice']
  },
  'frozen_ocean': {
    description: 'a frozen ocean',
    features: ['ice', 'packed ice', 'blue ice']
  },
  'frozen_river': {
    description: 'a frozen river',
    features: ['ice', 'snow', 'water']
  },
  'nether_wastes': {
    description: 'a barren nether landscape',
    features: ['netherrack', 'soul sand', 'glowstone']
  },
  'crimson_forest': {
    description: 'a red nether forest',
    features: ['crimson stems', 'nether wart blocks', 'shroomlights']
  },
  'warped_forest': {
    description: 'a blue nether forest',
    features: ['warped stems', 'warped wart blocks', 'shroomlights']
  },
  'soul_sand_valley': {
    description: 'a valley of soul sand',
    features: ['soul sand', 'soul soil', 'basalt']
  },
  'basalt_deltas': {
    description: 'a delta of basalt pillars',
    features: ['basalt', 'blackstone', 'magma blocks']
  },
  'the_end': {
    description: 'the end dimension',
    features: ['end stone', 'chorus plants', 'end cities']
  },
  'end_highlands': {
    description: 'the end highlands',
    features: ['end stone', 'chorus plants', 'end cities']
  },
  'end_midlands': {
    description: 'the end midlands',
    features: ['end stone', 'chorus plants', 'end cities']
  },
  'end_barrens': {
    description: 'the barren end',
    features: ['end stone', 'chorus plants', 'end cities']
  },
  'small_end_islands': {
    description: 'small end islands',
    features: ['end stone', 'chorus plants', 'end cities']
  },
  'beach': {
    description: 'a sandy beach',
    features: ['sand', 'gravel', 'seagrass']
  },
  'stone_shore': {
    description: 'a rocky shore',
    features: ['stone', 'gravel', 'water']
  },
  'mushroom_fields': {
    description: 'a mushroom-covered landscape',
    features: ['mycelium', 'mushrooms', 'mushroom blocks']
  },
  'mushroom_field_shore': {
    description: 'a mushroom-covered shore',
    features: ['mycelium', 'mushrooms', 'water']
  },
  'deep_ocean': {
    description: 'a deep ocean',
    features: ['water', 'kelp', 'seagrass']
  },
  'warm_ocean': {
    description: 'a warm ocean',
    features: ['water', 'coral', 'sea pickles']
  },
  'lukewarm_ocean': {
    description: 'a lukewarm ocean',
    features: ['water', 'kelp', 'seagrass']
  },
  'cold_ocean': {
    description: 'a cold ocean',
    features: ['water', 'kelp', 'seagrass']
  },
  'deep_warm_ocean': {
    description: 'a deep warm ocean',
    features: ['water', 'coral', 'sea pickles']
  },
  'deep_lukewarm_ocean': {
    description: 'a deep lukewarm ocean',
    features: ['water', 'kelp', 'seagrass']
  },
  'deep_cold_ocean': {
    description: 'a deep cold ocean',
    features: ['water', 'kelp', 'seagrass']
  },
  'deep_frozen_ocean': {
    description: 'a deep frozen ocean',
    features: ['water', 'ice', 'kelp']
  },
  'wooded_hills': {
    description: 'wooded hills',
    features: ['trees', 'grass', 'flowers']
  },
  'taiga_hills': {
    description: 'taiga hills',
    features: ['spruce trees', 'grass', 'ferns']
  },
  'mountain_edge': {
    description: 'mountain edges',
    features: ['stone', 'grass', 'trees']
  },
  'jungle_hills': {
    description: 'jungle hills',
    features: ['tall trees', 'vines', 'bamboo']
  },
  'desert_hills': {
    description: 'desert hills',
    features: ['sand', 'cacti', 'dead bushes']
  },
  'birch_forest': {
    description: 'a birch forest',
    features: ['birch trees', 'grass', 'flowers']
  },
  'birch_forest_hills': {
    description: 'birch forest hills',
    features: ['birch trees', 'grass', 'flowers']
  },
  'dark_forest': {
    description: 'a dark forest',
    features: ['dark oak trees', 'grass', 'mushrooms']
  },
  'dark_forest_hills': {
    description: 'dark forest hills',
    features: ['dark oak trees', 'grass', 'mushrooms']
  },
  'giant_tree_taiga': {
    description: 'a giant tree taiga',
    features: ['giant spruce trees', 'mossy cobblestone', 'ferns']
  },
  'giant_tree_taiga_hills': {
    description: 'giant tree taiga hills',
    features: ['giant spruce trees', 'mossy cobblestone', 'ferns']
  },
  'modified_jungle': {
    description: 'a modified jungle',
    features: ['tall trees', 'vines', 'bamboo']
  },
  'modified_jungle_edge': {
    description: 'a modified jungle edge',
    features: ['tall trees', 'vines', 'bamboo']
  },
  'tall_birch_forest': {
    description: 'a tall birch forest',
    features: ['tall birch trees', 'grass', 'flowers']
  },
  'tall_birch_hills': {
    description: 'tall birch hills',
    features: ['tall birch trees', 'grass', 'flowers']
  },
  'giant_spruce_taiga': {
    description: 'a giant spruce taiga',
    features: ['giant spruce trees', 'mossy cobblestone', 'ferns']
  },
  'giant_spruce_taiga_hills': {
    description: 'giant spruce taiga hills',
    features: ['giant spruce trees', 'mossy cobblestone', 'ferns']
  },
  'modified_gravelly_mountains': {
    description: 'modified gravelly mountains',
    features: ['gravel', 'stone', 'coal ore']
  },
  'shattered_savanna': {
    description: 'a shattered savanna',
    features: ['acacia trees', 'grass', 'terracotta']
  },
  'shattered_savanna_plateau': {
    description: 'a shattered savanna plateau',
    features: ['acacia trees', 'grass', 'terracotta']
  },
  'eroded_badlands': {
    description: 'eroded badlands',
    features: ['terracotta', 'red sand', 'dead bushes']
  },
  'modified_wooded_badlands_plateau': {
    description: 'modified wooded badlands plateau',
    features: ['terracotta', 'red sand', 'dead bushes']
  },
  'modified_badlands_plateau': {
    description: 'modified badlands plateau',
    features: ['terracotta', 'red sand', 'dead bushes']
  },
  'dripstone_caves': {
    description: 'dripstone caves',
    features: ['dripstone', 'pointed dripstone', 'water']
  },
  'lush_caves': {
    description: 'lush caves',
    features: ['azalea', 'moss', 'glow berries']
  },
  'deep_dark': {
    description: 'the deep dark',
    features: ['sculk', 'sculk sensors', 'sculk shriekers']
  }
};

export class QueryTask extends BaseTask {
  private queryType: string;
  protected mineflayerBot: MineflayerBot;
  private metadata: { result: any };
  private filters?: {
    itemType?: string;
    minCount?: number;
    maxCount?: number;
    radius?: number;
    blockType?: string;
  };

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: QueryTaskParameters) {
    super(bot, commandHandler, options);
    this.queryType = options.queryType;
    this.filters = options.filters;
    this.mineflayerBot = bot.getMineflayerBot();
    this.metadata = { result: null };
  }

  private getBiomeDescription(metadata: { description: string; features: string[] }): string {
    return metadata.description;
  }

  private async formatQueryResult(result: any): Promise<string> {
    switch (this.queryType) {
      case 'position':
        const biome = this.bot.getBiomeAt(this.mineflayerBot.entity.position);
        const biomeDesc = this.getBiomeDescription(BIOME_METADATA[biome || 'unknown'] || {
          description: 'an unknown biome',
          features: []
        });
        return `I'm at coordinates (${result.x.toFixed(1)}, ${result.y.toFixed(1)}, ${result.z.toFixed(1)}) in ${biomeDesc}`;
      
      case 'inventory':
        if (result.length === 0) return "I don't have any items in my inventory.";
        
        // Check if the query is about a specific item
        if (this.filters?.itemType) {
          const matchingItems = result.filter((item: any) => 
            item.name.toLowerCase().includes(this.filters!.itemType!.toLowerCase())
          );
          
          if (matchingItems.length === 0) {
            return `I don't have any ${this.filters.itemType} in my inventory.`;
          }
          
          const itemCount = matchingItems.reduce((sum: number, item: any) => sum + item.count, 0);
          return `I have ${itemCount} ${this.filters.itemType} in my inventory.`;
        }
        
        // If no specific item requested, list all items
        const itemGroups = new Map<string, number>();
        result.forEach((item: any) => {
          const count = itemGroups.get(item.name) || 0;
          itemGroups.set(item.name, count + item.count);
        });
        
        const itemsList = Array.from(itemGroups.entries())
          .map(([name, count]) => `${count} ${name}`)
          .join(', ');
        
        return `I have: ${itemsList}`;
      
      case 'health':
        const hearts = Math.floor(result.health / 2);
        const halfHeart = result.health % 2 === 1;
        const foodLevel = result.food;
        return `I have ${hearts}${halfHeart ? '½' : ''} hearts of health and my food level is ${foodLevel}/20.`;
      
      case 'time':
        return `It's currently ${result.isDay ? 'day' : 'night'} (time of day: ${result.timeOfDay}).`;
      
      case 'weather':
        const weatherDesc = result.isRaining ? 
          (result.isThundering ? 'thundering' : 'raining') : 
          'clear';
        return `The weather is ${weatherDesc}.`;
      
      case 'biome':
        const biomeId2 = this.mineflayerBot.world.getBiome(result.position);
        const biomeName = this.bot.getBiomeAt(result.position);
        const biomeMetadata = BIOME_METADATA[biomeName || 'unknown'] || {
          description: 'an unknown biome',
          features: []
        };
        
        const featuresList = biomeMetadata.features.length > 0 
          ? ` Common features include ${biomeMetadata.features.join(', ')}.`
          : '';
        
        return `I'm in ${this.getBiomeDescription(biomeMetadata)}${featuresList} Coordinates: (${result.position.x.toFixed(1)}, ${result.position.y.toFixed(1)}, ${result.position.z.toFixed(1)})`;
      
      default:
        return JSON.stringify(result);
    }
  }

  private async getQueryResult(): Promise<any> {
    let result: any;

    switch (this.queryType) {
      case 'position':
        const biomeId = this.mineflayerBot.world.getBiome(this.mineflayerBot.entity.position);
        const biomeName = this.bot.getBiomeAt(this.mineflayerBot.entity.position);
        result = {
          x: this.mineflayerBot.entity.position.x,
          y: this.mineflayerBot.entity.position.y,
          z: this.mineflayerBot.entity.position.z,
          biome: {
            name: biomeName,
            temperature: 0, // These values are not available through the public API
            rainfall: 0
          },
          time: {
            timeOfDay: this.mineflayerBot.time.timeOfDay,
            isDay: this.mineflayerBot.time.isDay
          },
          weather: {
            isRaining: this.mineflayerBot.isRaining,
            isThundering: this.mineflayerBot.thunderState > 0
          }
        };
        break;
      case 'inventory':
        result = this.mineflayerBot.inventory.items().map(item => ({
          name: item.name,
          count: item.count
        }));
        break;
      case 'health':
        result = {
          health: this.mineflayerBot.health,
          food: this.mineflayerBot.food
        };
        break;
      case 'time':
        result = {
          timeOfDay: this.mineflayerBot.time.timeOfDay,
          isDay: this.mineflayerBot.time.isDay
        };
        break;
      case 'weather':
        result = {
          isRaining: this.mineflayerBot.isRaining,
          isThundering: this.mineflayerBot.thunderState > 0
        };
        break;
      case 'biome':
        const biomeId2 = this.mineflayerBot.world.getBiome(result.position);
        const biomeName2 = this.bot.getBiomeAt(result.position);
        result = {
          biome: {
            name: biomeName2,
            temperature: 0, // These values are not available through the public API
            rainfall: 0
          },
          position: {
            x: this.mineflayerBot.entity.position.x,
            y: this.mineflayerBot.entity.position.y,
            z: this.mineflayerBot.entity.position.z
          }
        };
        break;
      default:
        throw new Error(`Unknown query type: ${this.queryType}`);
    }

    this.metadata = { result };
    return result;
  }

  private async checkCraftingMaterials(toolType: string): Promise<boolean> {
    const toolManager = this.bot.getToolManager();
    const materials = ['wooden', 'stone', 'iron', 'golden', 'diamond', 'netherite'];
    
    // Try to find the highest tier we can craft
    for (const material of materials) {
      const recipe = toolManager.getToolRecipe(toolType, material);
      if (recipe) {
        const missingMaterials = await toolManager.checkMissingMaterials(recipe);
        if (missingMaterials.length === 0) {
          return true;
        }
      }
    }
    return false;
  }

  public async performTask(): Promise<void> {
    try {
      const result = await this.getQueryResult();
      const formattedResponse = await this.formatQueryResult(result);
      this.mineflayerBot.chat(formattedResponse);
      await this.updateProgress(100);
      metrics.tasksCompleted.inc({ task_type: 'query' });
    } catch (error) {
      await this.handleError(error as Error, {
        category: 'LLM',
        severity: 'LOW',
        taskId: this.taskId!,
        taskType: 'query',
        metadata: this.metadata
      });
      if (!this.shouldRetry()) {
        throw error;
      }
      await this.retry();
    }
  }
} 