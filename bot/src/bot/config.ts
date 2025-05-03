import { BotOptions } from 'mineflayer';

export interface BotConfig extends BotOptions {
  checkTimeoutInterval: number;
  hideErrors: boolean;
  repairThreshold: number;
  repairQueue: {
    maxQueueSize: number;
    processInterval: number;
    priorityWeights: {
      durability: number;
      material: number;
    };
  };
  commandQueue: {
    maxSize: number;
    processInterval: number;
    retryConfig: {
      maxRetries: number;
      initialDelay: number;
      maxDelay: number;
      backoffFactor: number;
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
  preferredEnchantments: {
    pickaxe: string[];
    axe: string[];
    shovel: string[];
    sword: string[];
    hoe: string[];
  };
  repairMaterials: {
    wooden: string;
    stone: string;
    iron: string;
    golden: string;
    diamond: string;
    netherite: string;
  };
  cache: {
    ttl: number;
    maxSize: number;
    scanDebounceMs: number;
    cleanupInterval: number;
  };
}

export const defaultConfig: BotConfig = {
  host: process.env.MINECRAFT_HOST ?? 'localhost',
  port: parseInt(process.env.MINECRAFT_PORT ?? '50000', 10),
  username: process.env.MINECRAFT_USERNAME ?? 'bot',
  password: process.env.MINECRAFT_PASSWORD,
  version: process.env.MINECRAFT_VERSION ?? '1.21.4',
  checkTimeoutInterval: 60000,
  hideErrors: false,
  repairThreshold: 20,
  repairQueue: {
    maxQueueSize: 10,
    processInterval: 1000,
    priorityWeights: {
      durability: 0.7,
      material: 0.3
    }
  },
  commandQueue: {
    maxSize: 100,
    processInterval: 100,
    retryConfig: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2
    }
  },
  toolSelection: {
    efficiencyWeight: 0.2,
    durabilityWeight: 0.3,
    materialWeight: 0.3,
    enchantmentWeight: 0.2
  },
  crafting: {
    allowTierDowngrade: true,
    maxDowngradeAttempts: 2,
    preferExistingTools: true
  },
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
  cache: {
    ttl: 60000,
    maxSize: 1000,
    scanDebounceMs: 1000,
    cleanupInterval: 300000
  }
}; 