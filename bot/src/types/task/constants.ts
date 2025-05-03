/**
 * Task-related constants used throughout the codebase
 */

export const QUERY_TYPES = {
  INVENTORY: 'inventory',
  BLOCK: 'block',
  ENTITY: 'entity',
  BIOME: 'biome',
  TIME: 'time',
  POSITION: 'position'
} as const;

export const TASK_TYPES = {
  MINING: 'mining',
  FARMING: 'farming',
  CRAFTING: 'crafting',
  NAVIGATION: 'navigation',
  QUERY: 'query',
  GATHERING: 'gathering',
  INVENTORY: 'inventory',
  COMBAT: 'combat',
  INTERACTION: 'interaction',
  HEALING: 'healing',
  CHAT: 'chat',
  UNKNOWN: 'unknown'
} as const;

export const QUERY_EXAMPLES = {
  POSITION: {
    "type": "query",
    "parameters": {
      "queryType": "position",
      "filters": {}
    }
  },
  INVENTORY: {
    "type": "query",
    "parameters": {
      "queryType": "inventory",
      "filters": {
        "itemType": "diamond"
      }
    }
  }
} as const; 