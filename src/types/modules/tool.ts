/**
 * Types representing Minecraft tools and their properties.
 * This module defines the structure for tool management, including
 * tool types, materials, durability, and enchantments.
 */

/**
 * Valid tool types in Minecraft
 * @remarks
 * - Pickaxe: Used for mining stone and ores
 * - Shovel: Used for digging dirt and snow
 * - Axe: Used for chopping wood and pumpkins
 * - Hoe: Used for farming and tilling soil
 * - Shears: Used for harvesting wool and leaves
 * - Flint and Steel: Used for lighting fires and creating portals
 */
export type toolNames =
  | "pickaxe"
  | "axe"
  | "shovel"
  | "hoe"
  | "shears"
  | "flint_and_steel";

/**
 * Valid tool material tiers in Minecraft
 * @remarks Ordered from lowest to highest tier
 */
export type toolMaterials =
  | "wooden"
  | "stone"
  | "iron"
  | "golden"
  | "diamond"
  | "netherite";

/**
 * Maximum durability values for each tool material
 * @remarks Values represent the maximum uses before breaking
 */
export type toolDurability = 64 | 132 | 251 | 1562 | 1561 | 2031;

/**
 * Current durability of a tool
 */
export type currentDurability = number;

/**
 * Valid tool enchantments in Minecraft
 * @remarks
 * - efficiency: Increases mining speed
 * - unbreaking: Reduces durability loss
 * - mending: Repairs using XP
 * - fortune: Increases block drops
 * - silk_touch: Preserves block form
 * - vanishing_curse: Item disappears on death
 */
export type toolEnchantments =
  | "efficiency"
  | "unbreaking"
  | "mending"
  | "fortune"
  | "silk_touch"
  | "vanishing_curse";

/**
 * Represents a Minecraft tool with all its properties
 */
export interface Tool {
  /** The name of the tool */
  name: toolNames;
  /** The type of the tool */
  type: toolNames;
  /** The material the tool is made of */
  material: toolMaterials;
  /** Current durability of the tool */
  durability: currentDurability;
  /** Maximum durability of the tool based on material */
  maxDurability: toolDurability;
  /** List of enchantments on the tool */
  enchantments: Enchantment[];
  /** Inventory slot number where the tool is stored */
  slot: number;
}

/**
 * Represents a tool enchantment with its level
 */
export interface Enchantment {
  /** The name of the enchantment */
  name: toolEnchantments;
  /** The level of the enchantment (1-5 typically) */
  level: number;
}

/**
 * Configuration for the tool management system
 */
export interface ToolManagerConfig {
  /** Percentage of durability at which to trigger repairs (0-100) */
  repairThreshold: number;
  /** Preferred enchantments for each tool type */
  preferredEnchantments: {
    [key: string]: string[]; // Tool type -> list of preferred enchantments
  };
  /** Materials needed to repair each tool type */
  repairMaterials: {
    [key: string]: string; // Tool material -> repair material
  };
  /** Settings for the repair queue system */
  repairQueue: {
    /** Maximum number of tools that can be queued for repair */
    maxQueueSize: number;
    /** How often to process the repair queue (in ticks) */
    processInterval: number;
    /** Weights for prioritizing repairs */
    priorityWeights: {
      /** Weight for tool durability */
      durability: number;
      /** Weight for tool material */
      material: number;
    };
  };
  /** Settings for tool selection logic */
  toolSelection: {
    /** Weight for tool efficiency */
    efficiencyWeight: number;
    /** Weight for tool durability */
    durabilityWeight: number;
    /** Weight for tool material */
    materialWeight: number;
    /** Weight for tool enchantments */
    enchantmentWeight: number;
  };
  /** Settings for tool crafting behavior */
  crafting: {
    /** Whether to allow crafting lower-tier tools if materials are scarce */
    allowTierDowngrade: boolean;
    /** Maximum number of times to attempt downgrading */
    maxDowngradeAttempts: number;
    /** Whether to prefer using existing tools over crafting new ones */
    preferExistingTools: boolean;
  };
}

/**
 * Current state of the tool management system
 */
export interface ToolManagerState {
  /** Currently equipped tool */
  currentTool: Tool | null;
  /** List of all available tools */
  tools: Tool[];
  /** Count of repair materials available */
  repairMaterials: { [key: string]: number }; // Material name -> count
  /** Current anvil window for repairs, if open */
  currentAnvilWindow: any | null;
}
