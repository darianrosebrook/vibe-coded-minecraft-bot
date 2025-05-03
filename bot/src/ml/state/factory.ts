import { Vec3 } from 'vec3';
import { MLInventory, MLItem, MLInventoryConverter } from '../../types/ml/shared';
import { TaskHistory } from '../../types/ml/state';
import { Entity, EntityType } from 'prismarine-entity';
import { Inventory, Item } from '../../types/inventory';
import { Recipe } from 'prismarine-recipe';

interface CraftingRecipe extends Recipe {
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  tools: string[];
  time: number;
}

/**
 * Factory for creating ML state objects
 */
export class MLStateFactory implements MLInventoryConverter {
  /**
   * Creates an ML inventory with default values
   */
  protected createDefaultMLInventory(): MLInventory {
    return {
      items: [],
      size: 36
    };
  }

  /**
   * Converts a standard inventory to ML inventory format
   */
  convertToMLInventory(inventory: Inventory): MLInventory {
    return {
      items: inventory.items.map(item => ({
        type: item.name,
        quantity: item.count,
        metadata: {
          durability: item.durability,
          enchantments: item.enchantments,
          nbt: item.nbt
        }
      })),
      size: inventory.size
    };
  }

  /**
   * Converts a standard item to ML item format
   */
  static convertToMLItem(item: Item): MLItem {
    return {
      type: item.name,
      quantity: item.count,
      metadata: {
        durability: item.durability,
        enchantments: item.enchantments,
        nbt: item.nbt
      }
    };
  }

  /**
   * Creates a default entity object for ML processing
   */
  static createDefaultEntity(type: EntityType): Entity {
    const entity = new Entity(-1);
    entity.type = type;
    entity.position = new Vec3(0, 0, 0);
    entity.velocity = new Vec3(0, 0, 0);
    entity.yaw = 0;
    entity.pitch = 0;
    entity.onGround = true;
    entity.height = 1.8;
    entity.width = 0.6;
    entity.effects = [];
    entity.equipment = [];
    entity.metadata = [];
    entity.isValid = true;
    entity.passengers = [];
    
    return entity;
  }

  /**
   * Creates a resource location map for ML
   */
  static createResourceMap(resources: string[] = []): Map<string, Vec3[]> {
    const resourceMap = new Map<string, Vec3[]>();

    for (const resource of resources) {
      resourceMap.set(resource, []);
    }

    return resourceMap;
  }

  /**
   * Creates a biome-to-blocks mapping
   */
  static createBiomeBlocksMap(biomes: string[] = []): Map<string, Set<string>> {
    const biomeMap = new Map<string, Set<string>>();

    for (const biome of biomes) {
      biomeMap.set(biome, new Set<string>());
    }

    return biomeMap;
  }

  /**
   * Creates a state object used for ML model input
   */
  static createMLModelInput(botState: any = null, worldState: any = null) {
    const defaultState = {
      botState: botState || {
        position: new Vec3(0, 0, 0),
        health: 20,
        food: 20,
        experience: 0
      },
      worldState: worldState || {
        time: 0,
        weather: 'clear',
        difficulty: 'normal',
        dimension: 'overworld'
      },
      taskHistory: [] as TaskHistory[]
    };

    const recentTasks = defaultState.taskHistory.map((task: TaskHistory) => {
      const { type, startTime, endTime, success } = task;
      const duration = endTime && startTime ? endTime - startTime : 0;
      return { type, duration, success };
    });

    // Flatten the state for ML input
    return {
      // Bot state
      botPosX: defaultState.botState.position.x,
      botPosY: defaultState.botState.position.y,
      botPosZ: defaultState.botState.position.z,
      botHealth: defaultState.botState.health,
      botFood: defaultState.botState.food,
      botExp: defaultState.botState.experience,

      // World state
      worldTime: defaultState.worldState.time,
      worldWeather: defaultState.worldState.weather === 'clear' ? 0 :
        defaultState.worldState.weather === 'rain' ? 1 : 2,
      worldDifficulty: defaultState.worldState.difficulty === 'peaceful' ? 0 :
        defaultState.worldState.difficulty === 'easy' ? 1 :
          defaultState.worldState.difficulty === 'normal' ? 2 : 3,
      worldDimension: defaultState.worldState.dimension === 'overworld' ? 0 :
        defaultState.worldState.dimension === 'nether' ? 1 : 2,

      // Task history (last 3 tasks)
      recentTask1: defaultState.taskHistory.length > 0 && defaultState.taskHistory[0]?.type ? defaultState.taskHistory[0].type : '',
      recentTask2: defaultState.taskHistory.length > 1 && defaultState.taskHistory[1]?.type ? defaultState.taskHistory[1].type : '',
      recentTask3: defaultState.taskHistory.length > 2 && defaultState.taskHistory[2]?.type ? defaultState.taskHistory[2].type : ''
    };
  }
} 