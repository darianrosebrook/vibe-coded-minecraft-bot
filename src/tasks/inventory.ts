import { MinecraftBot } from '../bot/bot';
import { InventoryTaskParameters, } from '@/types/task';
import { Bot as MineflayerBot } from 'mineflayer';
import { BaseTask, TaskOptions } from './base';
import { CommandHandler } from '../commands';
import logger from '../utils/observability/logger';
import { CentralizedDataCollector } from '../ml/state/centralized_data_collector';
import { TrainingDataStorage } from '../ml/state/training_data_storage';
import { TaskStorage } from '../storage/taskStorage';
import { IDataCollector } from '@/types/ml/interfaces';

// Define item categories with more specific types
interface ItemCategory {
  name: string;
  slots: number[];
  priority: number;
  matchers: {
    namePatterns: string[];
    typePatterns?: string[];
    metadataPatterns?: Record<string, any>[];
  };
}

const INVENTORY_CATEGORIES: ItemCategory[] = [
  {
    name: 'tools',
    slots: [0, 1, 2, 3],
    priority: 1,
    matchers: {
      namePatterns: ['_pickaxe', '_axe', '_shovel', '_hoe', '_shears', 'fishing_rod'],
      typePatterns: ['tool']
    }
  },
  {
    name: 'weapons',
    slots: [4, 5, 6],
    priority: 2,
    matchers: {
      namePatterns: ['_sword', '_bow', 'crossbow', 'trident'],
      typePatterns: ['weapon']
    }
  },
  {
    name: 'armor',
    slots: [36, 37, 38, 39],
    priority: 3,
    matchers: {
      namePatterns: ['_helmet', '_chestplate', '_leggings', '_boots', 'shield'],
      typePatterns: ['armor']
    }
  },
  {
    name: 'food',
    slots: [7, 8, 9],
    priority: 4,
    matchers: {
      namePatterns: ['_food', 'apple', 'bread', 'meat', 'fish', 'potion'],
      typePatterns: ['food', 'potion']
    }
  },
  {
    name: 'blocks',
    slots: [10, 11, 12, 13, 14, 15],
    priority: 5,
    matchers: {
      namePatterns: ['_block', '_planks', '_log', '_stone', '_bricks', '_slab', '_stairs'],
      typePatterns: ['block']
    }
  },
  {
    name: 'resources',
    slots: [16, 17, 18, 19, 20, 21],
    priority: 6,
    matchers: {
      namePatterns: ['_ingot', '_ore', '_gem', 'diamond', 'emerald', 'redstone', 'coal', 'iron', 'gold'],
      typePatterns: ['material']
    }
  },
  {
    name: 'misc',
    slots: [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    priority: 7,
    matchers: {
      namePatterns: [], // Catch-all category
      typePatterns: []
    }
  }
];

interface InventoryMLState {
  inventoryState: {
    itemCount: number;
    totalItems: number;
    efficiency: number;
  };
  operation: {
    type: string;
    success: boolean;
    timeTaken: number;
  };
  categories: {
    name: string;
    itemCount: number;
    efficiency: number;
  }[];
}

export class InventoryTask extends BaseTask {
  protected override readonly bot: MinecraftBot;
  protected override readonly commandHandler: CommandHandler;
  protected override readonly options: InventoryTaskParameters;
  protected override mineflayerBot: MineflayerBot;
  protected override stopRequested: boolean = false;
  protected items: Array<{ name: string; count: number; slot: number }> = [];
  protected override dataCollector!: IDataCollector;
  protected override storage!: TaskStorage;
  protected override trainingStorage!: TrainingDataStorage;
  protected override startTime: number = 0;
  protected mlState: InventoryMLState | null = null;

  constructor(
    bot: MinecraftBot,
    commandHandler: CommandHandler,
    options: InventoryTaskParameters,
    dataCollector?: IDataCollector
  ) {
    super(bot, commandHandler, {
      ...options,
      useML: options.useML ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      timeout: options.timeout ?? 70000
    });
    this.bot = bot;
    this.commandHandler = commandHandler;
    this.options = options;
    this.mineflayerBot = bot.getMineflayerBot();

    // Initialize data collection
    if (dataCollector) {
      this.dataCollector = dataCollector;
    }
    this.storage = new TaskStorage('./data');
    this.trainingStorage = new TrainingDataStorage();
  }

  protected async getTaskSpecificState(): Promise<InventoryMLState> {
    return {
      inventoryState: {
        itemCount: this.items.length,
        totalItems: this.items.reduce((sum, item) => sum + item.count, 0),
        efficiency: this.calculateInventoryEfficiency()
      },
      operation: {
        type: this.options.operation,
        success: true,
        timeTaken: Date.now() - this.startTime
      },
      categories: INVENTORY_CATEGORIES.map(category => ({
        name: category.name,
        itemCount: this.items.filter(item =>
          category.matchers.namePatterns.some(pattern => item.name.includes(pattern))
        ).length,
        efficiency: this.calculateCategoryEfficiency(category)
      }))
    };
  }

  private calculateInventoryEfficiency(): number {
    if (this.startTime === 0) return 0;
    const timeElapsed = Date.now() - this.startTime;
    return this.items.length / (timeElapsed / 1000);
  }

  private calculateCategoryEfficiency(category: ItemCategory): number {
    const categoryItems = this.items.filter(item =>
      category.matchers.namePatterns.some(pattern => item.name.includes(pattern))
    );
    return categoryItems.length / category.slots.length;
  }

  private async sortInventory(): Promise<boolean> {
    const startTime = Date.now();
    try {
      const inventory = this.mineflayerBot.inventory;
      const items = inventory.items();

      // Group items by category
      const categorizedItems = new Map<string, typeof items>();
      for (const item of items) {
        const category = this.findBestCategory(item);
        if (!categorizedItems.has(category)) {
          categorizedItems.set(category, []);
        }
        categorizedItems.get(category)!.push(item);
      }

      // Sort items within each category
      for (const [category, categoryItems] of categorizedItems) {
        // Sort by name and stack size
        categoryItems.sort((a, b) => {
          if (a.name !== b.name) return a.name.localeCompare(b.name);
          return b.count - a.count; // Put larger stacks first
        });

        // Get target slots for this category
        const categoryConfig = INVENTORY_CATEGORIES.find(c => c.name === category);
        if (!categoryConfig) continue;

        // Move items to their target slots
        for (let i = 0; i < categoryItems.length; i++) {
          const item = categoryItems[i];
          const targetSlot = categoryConfig.slots[i];

          if (targetSlot === undefined) {
            // No more slots in this category, move to misc
            const miscCategory = INVENTORY_CATEGORIES.find(c => c.name === 'misc');
            if (!miscCategory) continue;

            const miscSlot = miscCategory.slots.find(slot =>
              !items.some(item => item.slot === slot)
            );
            if (miscSlot === undefined) continue;
            if (!item) {
              this.bot.chat('No item to move to misc slot');
              continue;
            }
            try {
              await this.mineflayerBot.moveSlotItem(item.slot, miscSlot);
            } catch (error) {
              logger.warn(`Failed to move item ${item.name} to misc slot ${miscSlot}`, { error });
            }
          } else {
            if (!item) {
              this.bot.chat('No item to move to category slot');
              continue;
            }
            try {
              await this.mineflayerBot.moveSlotItem(item.slot, targetSlot);
            } catch (error) {
              logger.warn(`Failed to move item ${item.name} to category slot ${targetSlot}`, { error });
            }
          }
        }
      }

      // Update inventory state
      this.items = items.map(item => ({
        name: item.name,
        count: item.count,
        slot: item.slot
      }));

      // Record successful sorting
      if (this.options.useML) {
        await this.dataCollector.recordPrediction(
          'inventory_sort',
          {
            itemCount: this.items.length,
            categories: Array.from(categorizedItems.keys())
          },
          {
            success: true,
            timeTaken: Date.now() - startTime
          },
          true,
          1.0,
          Date.now() - startTime,
          {
            operation: 'sort'
          }
        );
      }

      return true;
    } catch (error) {
      // Record failed sorting
      if (this.options.useML) {
        await this.dataCollector.recordPrediction(
          'inventory_sort',
          {
            itemCount: this.items.length
          },
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          false,
          0.0,
          Date.now() - startTime,
          {
            operation: 'sort'
          }
        );
      }

      throw error;
    }
  }

  private findBestCategory(item: any): string {
    // Find the category with the highest priority that matches this item
    let bestCategory = 'misc';
    let bestPriority = 0;

    for (const category of INVENTORY_CATEGORIES) {
      const matches = category.matchers.namePatterns.some(pattern =>
        item.name.includes(pattern)
      ) || category.matchers.typePatterns?.some(pattern =>
        item.type === pattern
      );

      if (matches && category.priority > bestPriority) {
        bestCategory = category.name;
        bestPriority = category.priority;
      }
    }

    return bestCategory;
  }

  private async transferItems(): Promise<boolean> {
    const startTime = Date.now();
    try {
      const inventory = this.mineflayerBot.inventory;
      const items = inventory.items();

      // Transfer items to chest
      for (const item of items) {
        if (item.name === this.options.itemType) {
          await this.mineflayerBot.moveSlotItem(item.slot, -1);
        }
      }

      this.items = items.map(item => ({
        name: item.name,
        count: item.count,
        slot: item.slot
      }));

      // Record successful transfer
      if (this.options.useML) {
        await this.dataCollector.recordPrediction(
          'inventory_transfer',
          {
            itemType: this.options.itemType,
            itemCount: items.filter(i => i.name === this.options.itemType).length
          },
          {
            success: true,
            timeTaken: Date.now() - startTime
          },
          true,
          1.0,
          Date.now() - startTime,
          {
            operation: 'transfer'
          }
        );

        // Store training data
        const trainingData = this.dataCollector.getTrainingData('inventory_transfer');
        if (trainingData) {
          await this.trainingStorage.storeTrainingData('inventory_transfer', trainingData, 1);
        }
      }

      return true;
    } catch (error) {
      // Record failed transfer
      if (this.options.useML) {
        await this.dataCollector.recordPrediction(
          'inventory_transfer',
          {
            itemType: this.options.itemType,
            itemCount: this.items.filter(i => i.name === this.options.itemType).length
          },
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          false,
          0.0,
          Date.now() - startTime,
          {
            operation: 'transfer'
          }
        );

        // Store training data
        const trainingData = this.dataCollector.getTrainingData('inventory_transfer');
        if (trainingData) {
          await this.trainingStorage.storeTrainingData('inventory_transfer', trainingData, 1);
        }
      }

      throw error;
    }
  }

  override async validateTask(): Promise<void> {
    await super.validateTask();

    if (!this.options.operation) {
      throw new Error('Operation type is required');
    }

  }

  override async initializeProgress(): Promise<void> {
    await super.initializeProgress();
    this.items = [];
  }

  private async updateInventoryState(): Promise<void> {
    const inventory = this.mineflayerBot.inventory;
    const items = inventory.items();
    this.items = items.map(item => ({
      name: item.name,
      count: item.count,
      slot: item.slot
    }));
  }

  protected async countItems(): Promise<void> {
    const inventory = this.mineflayerBot.inventory;
    const items = inventory.items();
    this.items = items.map(item => ({
      name: item.name,
      count: item.count,
      slot: item.slot
    }));
  }

  protected async checkInventory(): Promise<void> {
    const inventory = this.mineflayerBot.inventory;
    const items = inventory.items();
    this.items = items.map(item => ({
      name: item.name,
      count: item.count,
      slot: item.slot
    }));
  }


  override async performTask(): Promise<void> {
    this.startTime = Date.now();

    try {
      // Update initial inventory state
      await this.updateInventoryState();

      // Perform inventory operation
      switch (this.options.operation) {
        case 'sort':
          await this.sortInventory();
          break;
        case 'count':
          await this.countItems();
          break;
        case 'check':
          await this.checkInventory();
          break;
        default:
          throw new Error(`Unknown operation: ${this.options.operation}`);
      }

      // Store final training data
      if (this.options.useML) {
        const trainingData = this.dataCollector.getTrainingData('inventory_state');
        if (trainingData) {
          await this.trainingStorage.storeTrainingData('inventory_state', trainingData, 1);
        }
      }
    } catch (error) {
      logger.error('Inventory task failed', { error });
      throw error;
    } finally {
      this.dataCollector.stop();
    }
  }

  public override stop(): void {
    this.stopRequested = true;
  }
} 