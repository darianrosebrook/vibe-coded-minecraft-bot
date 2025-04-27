import { ToolManagerConfig } from '../types/tool';

export const defaultToolManagerConfig: ToolManagerConfig = {
  repairThreshold: 20, // Repair when durability is at 20%
  preferredEnchantments: {
    pickaxe: ['efficiency', 'unbreaking', 'fortune'],
    axe: ['efficiency', 'unbreaking', 'fortune'],
    shovel: ['efficiency', 'unbreaking', 'fortune'],
    sword: ['sharpness', 'unbreaking', 'looting'],
    hoe: ['efficiency', 'unbreaking']
  },
  repairMaterials: {
    wooden: 'planks',
    stone: 'cobblestone',
    iron: 'iron_ingot',
    golden: 'gold_ingot',
    diamond: 'diamond',
    netherite: 'netherite_ingot'
  },
  // New configuration options
  repairQueue: {
    maxQueueSize: 10, // Maximum number of tools in repair queue
    processInterval: 1000, // How often to process the queue (ms)
    priorityWeights: {
      durability: 0.7, // Weight for durability in priority calculation
      material: 0.3 // Weight for material in priority calculation
    }
  },
  toolSelection: {
    efficiencyWeight: 0.2, // Weight for efficiency in tool selection
    durabilityWeight: 0.3, // Weight for durability in tool selection
    materialWeight: 0.3, // Weight for material in tool selection
    enchantmentWeight: 0.2 // Weight for enchantments in tool selection
  },
  crafting: {
    allowTierDowngrade: true, // Whether to try lower tier tools if crafting fails
    maxDowngradeAttempts: 2, // Maximum number of tier downgrades to attempt
    preferExistingTools: true // Whether to prefer using existing tools over crafting new ones
  }
}; 