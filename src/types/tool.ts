// Pickaxe - used to break blocks such as stone and items made of them faster; required to get the ores specified.
// Shovel - used to break blocks such as dirt faster. Needed to obtain snowballs from snow. Also can turn grass blocks to grass paths when right-clicked.
// Axe - used to break wooden items faster, along with pumpkins.
// Hoe - used in farming to prepare ground.
// Shears - used to harvest wool from sheep (other uses – collect leaves, tall grass and dead bushes).
// Flint and Steel - used to set things on fire. Can be used to make a fireplace, or the Nether Portal.

type toolNames = 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'shears' | 'flint_and_steel';
type toolMaterials = 'wooden' | 'stone' | 'iron' | 'golden' | 'diamond' | 'netherite';
type toolDurability = 64 | 132 | 251 | 1562 | 1561 | 2031;
type currentDurability = number;
type toolEnchantments = 'efficiency' | 'unbreaking' | 'mending' | 'fortune' | 'silk_touch' | 'vanishing_curse';

export interface Tool {
  name: toolNames;
  type: toolNames;
  material: toolMaterials;
  durability: currentDurability;
  maxDurability: toolDurability;
  enchantments: Enchantment[];
  slot: number;
}

export interface Enchantment {
  name: toolEnchantments;
  level: number;
}

export interface ToolManagerConfig {
  repairThreshold: number; // Percentage of durability at which to repair
  preferredEnchantments: {
    [key: string]: string[]; // Tool type -> list of preferred enchantments
  };
  repairMaterials: {
    [key: string]: string; // Tool material -> repair material
  };
  repairQueue: {
    maxQueueSize: number;
    processInterval: number;
    priorityWeights: {
      durability: number;
      material: number;
    };
  };
  toolSelection: {
    efficiencyWeight: number;
    durabilityWeight: number;
    materialWeight: number;
    enchantmentWeight: number;
  };
  crafting: {
    allowTierDowngrade: boolean;
    maxDowngradeAttempts: number;
    preferExistingTools: boolean;
  };
}

export interface ToolManagerState {
  currentTool: Tool | null;
  tools: Tool[];
  repairMaterials: { [key: string]: number }; // Material name -> count
  currentAnvilWindow: any | null; // Store the current anvil window for repairs
} 