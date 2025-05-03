import { Bot as MineflayerBot } from 'mineflayer';
import { Tool, ToolManagerConfig, ToolManagerState, Enchantment } from '@/types/modules/tool';
import { toolRecipes, ToolRecipe } from '../config/crafting';
import { MinecraftBot, BotConfig } from './bot';
import { Window as PrismarineWindow } from 'prismarine-windows';

interface ToolUsageStats {
  tool: Tool;
  blocksMined: number;
  durabilityUsed: number;
  timeUsed: number;
  lastUsed: number;
  efficiency: number; // blocks mined per durability point
}

interface RepairQueueItem {
  tool: Tool;
  priority: number;
  timestamp: number;
}

export class ToolManager {
  private bot: MinecraftBot;
  private mineflayerBot: MineflayerBot;
  private config: ToolManagerConfig;
  private state: ToolManagerState;
  private usageStats: Map<string, ToolUsageStats>;
  private repairQueue: RepairQueueItem[];
  private isRepairing: boolean;

  constructor(bot: MinecraftBot, config: ToolManagerConfig) {
    this.bot = bot;
    this.mineflayerBot = bot.getMineflayerBot();
    this.config = config;
    this.state = {
      currentTool: null,
      tools: [],
      repairMaterials: {},
      currentAnvilWindow: null
    };
    this.usageStats = new Map();
    this.repairQueue = [];
    this.isRepairing = false;

    this.initialize();
  }

  private initialize() {
    // Set up event listeners
    this.mineflayerBot.on('diggingCompleted', this.handleDiggingCompleted.bind(this));
    this.mineflayerBot.on('windowOpen', this.handleWindowOpen.bind(this));
    this.mineflayerBot.on('windowClose', this.handleWindowClose.bind(this));
    this.mineflayerBot.on('itemDrop', this.handleItemDrop.bind(this));

    // Add repair queue processing
    this.mineflayerBot.on('physicsTick', () => {
      if (!this.isRepairing && this.repairQueue.length > 0) {
        this.processRepairQueue();
      }
    });
  }

  private handleDiggingCompleted() {
    const currentItem = this.mineflayerBot.heldItem;
    if (currentItem && this.isTool(currentItem)) {
      this.updateToolDurability(currentItem);
      this.checkRepairNeeded(currentItem);
      this.updateUsageStats(currentItem);
    }
  }

  private handleItemDrop(item: any) {
    // Update repair materials count when items are dropped
    const materialName = this.getMaterialName(item.name);
    if (materialName && this.config.repairMaterials[materialName]) {
      this.state.repairMaterials[materialName] = (this.state.repairMaterials[materialName] || 0) + item.count;
    }
  }

  private getMaterialName(itemName: string): string | null {
    const materials = ['wooden', 'stone', 'iron', 'golden', 'diamond', 'netherite'];
    return materials.find(mat => itemName.includes(mat)) || null;
  }

  private handleWindowOpen(window: any) {
    if (window.type === 'anvil') {
      this.handleAnvilOpen(window);
    }
  }

  private handleWindowClose() {
    // Clear the anvil window reference
    this.state.currentAnvilWindow = null;
  }

  private isTool(item: any): boolean {
    const toolTypes = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'];
    return toolTypes.some(type => item.name.includes(type));
  }

  private updateToolDurability(item: any) {
    const tool = this.state.tools.find(t => t.slot === item.slot);
    if (tool) {
      tool.durability = item.durability;
    }
  }

  private checkRepairNeeded(item: any) {
    const durabilityPercentage = (item.durability / item.maxDurability) * 100;
    if (durabilityPercentage <= this.config.repairThreshold) {
      this.scheduleRepair(item);
    }
  }

  private async scheduleRepair(item: any) {
    const tool = this.createToolFromItem(item);
    const repairMaterial = this.config.repairMaterials[tool.material];
    if (!repairMaterial) return;

    // Check queue size limit
    if (this.repairQueue.length >= this.config.repairQueue.maxQueueSize) {
      console.log('Repair queue is full, cannot add more tools');
      return;
    }

    // Calculate repair priority using configured weights
    const durabilityPercentage = (tool.durability / tool.maxDurability) * 100;
    const materialPriority = {
      'netherite': 6,
      'diamond': 5,
      'iron': 4,
      'stone': 3,
      'golden': 2,
      'wooden': 1
    }[tool.material] || 1;

    const priority = 
      (100 - durabilityPercentage) * this.config.repairQueue.priorityWeights.durability +
      materialPriority * this.config.repairQueue.priorityWeights.material;

    // Add to repair queue
    this.repairQueue.push({
      tool,
      priority,
      timestamp: Date.now()
    });
  }

  private async repairTool(item: any, repairMaterial: string) {
    try {
      // Find an anvil
      const anvil = this.mineflayerBot.findBlock({
        matching: block => block.name === 'anvil',
        maxDistance: 32
      });

      if (!anvil) {
        console.log('No anvil found nearby for repair');
        return;
      }

      // Navigate to the anvil
      const goal = new (this.mineflayerBot.pathfinder as any).goals.GoalBlock(
        anvil.position.x,
        anvil.position.y,
        anvil.position.z
      );
      await this.mineflayerBot.pathfinder.goto(goal);

      // Find the repair material in inventory
      const repairItem = this.mineflayerBot.inventory.items().find(i => i.name === repairMaterial);
      if (!repairItem) {
        console.log(`No ${repairMaterial} found for repair`);
        return;
      }

      // Open the anvil
      const anvilWindow = await this.mineflayerBot.openAnvil(anvil);
      if (!anvilWindow) {
        console.log('Failed to open anvil');
        return;
      }

      // Place the tool in the first slot
      await this.mineflayerBot.clickWindow(0, 0, 0);
      
      // Place the repair material in the second slot
      await this.mineflayerBot.clickWindow(1, 0, 0);

      // Wait for the repair cost to be calculated
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if we can afford the repair
      const repairCost = (anvilWindow as any).repairCost;
      if (repairCost > this.mineflayerBot.experience.level) {
        console.log(`Not enough experience (${this.mineflayerBot.experience.level}/${repairCost}) for repair`);
        await this.mineflayerBot.closeWindow(anvilWindow as unknown as PrismarineWindow);
        return;
      }

      // Take the repaired item
      await this.mineflayerBot.clickWindow(2, 0, 0);
      await this.mineflayerBot.closeWindow(anvilWindow as unknown as PrismarineWindow);

      console.log(`Successfully repaired ${item.name} using ${repairMaterial}`);
    } catch (error) {
      console.error('Error during tool repair:', error);
    }
  }

  private handleAnvilOpen(window: any) {
    if (window.type !== 'anvil') return;

    // Store the anvil window for repair operations
    this.state.currentAnvilWindow = window;
  }

  public getBestToolForBlock(blockName: string): Tool | null {
    // Map block types to their preferred tool types
    const blockToToolMap: { [key: string]: string[] } = {
      'diamond_ore': ['pickaxe'],
      'iron_ore': ['pickaxe'],
      'gold_ore': ['pickaxe'],
      'coal_ore': ['pickaxe'],
      'redstone_ore': ['pickaxe'],
      'lapis_ore': ['pickaxe'],
      'emerald_ore': ['pickaxe'],
      'nether_gold_ore': ['pickaxe'],
      'nether_quartz_ore': ['pickaxe'],
      'ancient_debris': ['pickaxe'],
      'stone': ['pickaxe'],
      'cobblestone': ['pickaxe'],
      'dirt': ['shovel'],
      'grass_block': ['shovel'],
      'sand': ['shovel'],
      'gravel': ['shovel'],
      'log': ['axe'],
      'planks': ['axe'],
      'leaves': ['shears', 'sword'],
      'wool': ['shears'],
      'cobweb': ['sword'],
      'grass': ['shears', 'sword']
    };

    // Get the preferred tool types for this block
    const preferredToolTypes = blockToToolMap[blockName] || ['pickaxe'];
    
    // Find all tools in inventory
    const tools = this.mineflayerBot.inventory.items()
      .filter(item => this.isTool(item))
      .map(item => this.createToolFromItem(item));

    // Filter tools by preferred types
    const matchingTools = tools.filter(tool => 
      preferredToolTypes.includes(tool.type)
    );

    if (matchingTools.length === 0) {
      return null;
    }

    // Score each tool based on material, enchantments, and efficiency using configured weights
    const scoredTools = matchingTools.map(tool => {
      let score = 0;

      // Material score (higher is better)
      const materialScores: { [key: string]: number } = {
        'netherite': 6,
        'diamond': 5,
        'iron': 4,
        'stone': 3,
        'golden': 2,
        'wooden': 1
      };
      score += (materialScores[tool.material] || 0) * this.config.toolSelection.materialWeight;

      // Enchantment scores
      const enchantmentScores: { [key: string]: number } = {
        'efficiency': 2,
        'unbreaking': 1.5,
        'fortune': 3,
        'silk_touch': 2.5
      };

      let enchantmentScore = 0;
      tool.enchantments.forEach(enchantment => {
        enchantmentScore += (enchantmentScores[enchantment.name] || 0) * enchantment.level;
      });
      score += enchantmentScore * this.config.toolSelection.enchantmentWeight;

      // Durability consideration
      const durabilityPercentage = (tool.durability / tool.maxDurability) * 100;
      score *= (durabilityPercentage / 100) * this.config.toolSelection.durabilityWeight;

      // Efficiency consideration
      const efficiency = this.getToolEfficiency(tool.type, tool.material);
      score *= (1 + efficiency * 0.1) * this.config.toolSelection.efficiencyWeight;

      return { tool, score };
    });

    // Sort by score and return the best tool
    scoredTools.sort((a, b) => b.score - a.score);
    return scoredTools[0]?.tool || null;
  }

  private createToolFromItem(item: any): Tool {
    const toolTypes = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'];
    const toolType = toolTypes.find(type => item.name.includes(type)) || 'pickaxe';
    
    const materials = ['wooden', 'stone', 'iron', 'golden', 'diamond', 'netherite'];
    const material = materials.find(mat => item.name.includes(mat)) || 'wooden';

    return {
      name: item.name,
      type: toolType as any,
      material: material as any,
      durability: item.durability,
      maxDurability: item.maxDurability,
      enchantments: this.getEnchantmentsFromItem(item),
      slot: item.slot
    };
  }

  private getEnchantmentsFromItem(item: any): Enchantment[] {
    if (!item.nbt) return [];
    
    try {
      const nbt = item.nbt;
      if (!nbt.value?.Enchantments?.value?.value) return [];

      return nbt.value.Enchantments.value.value.map((ench: any) => ({
        name: ench.id.value.toLowerCase(),
        level: ench.lvl.value
      }));
    } catch (error) {
      console.error('Error parsing enchantments:', error);
      return [];
    }
  }

  public getToolEnchantments(tool: Tool): Enchantment[] {
    return tool.enchantments;
  }

  public hasEnchantment(tool: Tool, enchantmentName: string): boolean {
    return tool.enchantments.some(e => e.name === enchantmentName);
  }

  public getEnchantmentLevel(tool: Tool, enchantmentName: string): number {
    const enchantment = tool.enchantments.find(e => e.name === enchantmentName);
    return enchantment ? enchantment.level : 0;
  }

  public async craftTool(type: string, material: string): Promise<boolean> {
    try {
      // Find the recipe
      const recipe = toolRecipes.find(r => r.type === type && r.material === material);
      if (!recipe) {
        console.log(`No recipe found for ${material} ${type}`);
        return false;
      }

      // Check if we have a crafting table nearby
      const craftingTable = this.mineflayerBot.findBlock({
        matching: block => block.name === 'crafting_table',
        maxDistance: 32
      });
      
      if (!craftingTable) {
        console.log('No crafting table found nearby');
        return false;
      }

      // Navigate to the crafting table
      const goal = new (this.mineflayerBot.pathfinder as any).goals.GoalBlock(
        craftingTable.position.x,
        craftingTable.position.y,
        craftingTable.position.z
      );
      await this.mineflayerBot.pathfinder.goto(goal);

      // Check if we have all required materials
      const missingMaterials = await this.checkMissingMaterials(recipe);
      if (missingMaterials.length > 0) {
        console.log(`Missing materials for crafting: ${missingMaterials.join(', ')}`);
        return false;
      }

      if (recipe.craftingTable) {
        const craftingWindow = await this.mineflayerBot.openChest(craftingTable) as unknown as PrismarineWindow;
        if (!craftingWindow) {
          console.log('Failed to open crafting interface');
          return false;
        }
        await this.placeCraftingIngredients(craftingWindow, recipe);
        await this.mineflayerBot.clickWindow(0, 0, 0);
        await this.mineflayerBot.closeWindow(craftingWindow);
      } else {
        // Handle inventory crafting
        const items = this.mineflayerBot.inventory.items();
        // TODO: Implement inventory crafting logic
      }

      console.log(`Successfully crafted ${recipe.name}`);
      return true;
    } catch (error) {
      console.error('Error during tool crafting:', error);
      return false;
    }
  }

  public getToolRecipe(type: string, material: string): ToolRecipe | null {
    const recipe = toolRecipes.find(r => r.type === type && r.material === material);
    return recipe || null;
  }

  public async checkMissingMaterials(recipe: ToolRecipe): Promise<string[]> {
    const missingMaterials: string[] = [];
    const inventory = this.mineflayerBot.inventory;

    for (const [material, count] of Object.entries(recipe.material)) {
      const items = inventory.items().filter(item => item.name === material);
      const totalCount = items.reduce((sum, item) => sum + item.count, 0);
      
      if (totalCount < parseInt(count)) {
        missingMaterials.push(`${material} (${parseInt(count) - totalCount} more needed)`);
      }
    }

    return missingMaterials;
  }

  private async placeCraftingIngredients(window: PrismarineWindow, recipe: ToolRecipe) {
    const inventory = this.mineflayerBot.inventory.items();
    const craftingSlots = recipe.craftingTable ? 9 : 4;

    // Clear the crafting grid
    for (let i = 0; i < craftingSlots; i++) {
      await this.mineflayerBot.clickWindow(i, 0, 0);
    }

    // Place ingredients according to the recipe
    for (const [item, quantity] of Object.entries(recipe.ingredients)) {
      const items = inventory.filter(i => i.name === item);
      let remaining = quantity;

      for (const item of items) {
        if (remaining <= 0) break;
        const toTake = Math.min(remaining, item.count);
        await this.mineflayerBot.clickWindow(item.slot, 0, 0);
        remaining -= toTake;
      }
    }
  }

  public async ensureTool(type: string, material: string): Promise<boolean> {
    // Check if we already have the tool
    const existingTool = this.mineflayerBot.inventory.items().find(item => 
      item.name.includes(type) && item.name.includes(material)
    );

    if (existingTool && this.config.crafting.preferExistingTools) {
      return true;
    }

    // Try to craft the tool
    const success = await this.craftTool(type, material);
    
    if (!success && this.config.crafting.allowTierDowngrade) {
      // If crafting failed, try to craft a lower tier tool
      const materialTiers = ['wooden', 'stone', 'iron', 'golden', 'diamond', 'netherite'];
      const currentTierIndex = materialTiers.indexOf(material);
      
      let downgradeAttempts = 0;
      while (currentTierIndex > 0 && downgradeAttempts < this.config.crafting.maxDowngradeAttempts) {
        const lowerTier = materialTiers[currentTierIndex - 1];
        if (lowerTier && await this.ensureTool(type, lowerTier)) {
          return true;
        }
        downgradeAttempts++;
      }
    }

    return success;
  }

  private updateUsageStats(item: any) {
    const tool = this.createToolFromItem(item);
    const toolId = `${tool.type}_${tool.material}`;
    
    let stats = this.usageStats.get(toolId);
    if (!stats) {
      stats = {
        tool,
        blocksMined: 0,
        durabilityUsed: 0,
        timeUsed: 0,
        lastUsed: Date.now(),
        efficiency: 0
      };
      this.usageStats.set(toolId, stats);
    }

    // Update stats
    stats.blocksMined++;
    stats.durabilityUsed += item.maxDurability - item.durability;
    stats.timeUsed = Date.now() - stats.lastUsed;
    stats.efficiency = stats.blocksMined / (stats.durabilityUsed || 1);
  }

  public getToolStats(): ToolUsageStats[] {
    return Array.from(this.usageStats.values());
  }

  public getMostEfficientTool(type: string): Tool | null {
    const toolsOfType = Array.from(this.usageStats.values())
      .filter(stats => stats.tool.type === type)
      .sort((a, b) => b.efficiency - a.efficiency);

    return toolsOfType[0]?.tool || null;
  }

  public getToolDurabilityCost(type: string, material: string): number {
    const toolId = `${type}_${material}`;
    const stats = this.usageStats.get(toolId);
    return stats ? stats.durabilityUsed / stats.blocksMined : 0;
  }

  public getToolEfficiency(type: string, material: string): number {
    const toolId = `${type}_${material}`;
    const stats = this.usageStats.get(toolId);
    return stats?.efficiency || 0;
  }

  public getToolUsageTime(type: string, material: string): number {
    const toolId = `${type}_${material}`;
    const stats = this.usageStats.get(toolId);
    return stats?.timeUsed || 0;
  }

  public getToolBlockCount(type: string, material: string): number {
    const toolId = `${type}_${material}`;
    const stats = this.usageStats.get(toolId);
    return stats?.blocksMined || 0;
  }

  private async processRepairQueue() {
    if (this.repairQueue.length === 0) return;

    this.isRepairing = true;
    try {
      // Sort queue by priority and timestamp
      this.repairQueue.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.timestamp - b.timestamp;
      });

      const nextRepair = this.repairQueue.shift();
      if (nextRepair) {
        const repairMaterial = this.config.repairMaterials[nextRepair.tool.material];
        if (repairMaterial) {
          await this.repairTool(nextRepair.tool, repairMaterial);
        }
      }

      // Wait for the configured interval before processing next item
      await new Promise(resolve => setTimeout(resolve, this.config.repairQueue.processInterval));
    } finally {
      this.isRepairing = false;
    }
  }

  public updateConfig(config: Partial<BotConfig>): void {
    if (config.repairThreshold) this.config.repairThreshold = config.repairThreshold;
    if (config.preferredEnchantments) this.config.preferredEnchantments = config.preferredEnchantments;
    if (config.repairMaterials) this.config.repairMaterials = config.repairMaterials;
    if (config.repairQueue) this.config.repairQueue = config.repairQueue;
    if (config.toolSelection) this.config.toolSelection = config.toolSelection;
    if (config.crafting) this.config.crafting = config.crafting;
  }
} 