import { z } from 'zod';
import { TaskType, TaskParameters } from '@/types/task';

export interface CommandDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<TaskParameters>;
  validate?: (params: any) => Promise<boolean>;
  transform?: (params: any) => Promise<any>;
}

const entitySchema = z.object({
  type: z.string(),
  name: z.string(),
  distance: z.number(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  })
}).strict();

const botStateSchema = z.object({
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  }),
  health: z.number(),
  food: z.number(),
  inventory: z.array(z.object({
    name: z.string(),
    count: z.number()
  })),
  biome: z.string().optional(),
  isDay: z.boolean().optional(),
  isRaining: z.boolean().optional(),
  nearbyEntities: z.array(entitySchema).optional()
}).strict();

const contextSchema = z.object({
  lastMessage: z.string().optional(),
  playerName: z.string().optional(),
  botState: botStateSchema.optional()
}).strict();

const chatSchema = z.object({
  message: z.string(),
  chatType: z.enum(['whisper', 'normal', 'system', 'action']),
  context: contextSchema.optional(),
  maxRetries: z.number().optional(),
  retryDelay: z.number().optional(),
  timeout: z.number().optional(),
  useML: z.boolean().optional()
}).strict();

const miningSchema = z.object({
  targetBlock: z.string(),
  quantity: z.number().optional(),
  maxDistance: z.number().optional(),
  usePathfinding: z.boolean().optional(),
  yLevel: z.number().optional(),
  tool: z.string().optional(),
  radius: z.number().optional(),
  depth: z.number().optional(),
  useML: z.boolean().optional(),
  avoidWater: z.boolean().optional(),
  maxRetries: z.number().optional(),
  retryDelay: z.number().optional(),
  timeout: z.number().optional()
}).strict();

const navigationSchema = z.object({
  location: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  }),
  mode: z.enum(['walk', 'sprint', 'jump']).optional(),
  avoidWater: z.boolean().optional(),
  maxDistance: z.number().optional(),
  usePathfinding: z.boolean().optional(),
  radius: z.number().optional()
}).strict();

const farmingSchema = z.object({
  cropType: z.enum(['wheat', 'carrots', 'potatoes', 'beetroot']),
  action: z.enum(['plant', 'harvest', 'replant']),
  radius: z.number().optional(),
  checkInterval: z.number().optional(),
  requiresWater: z.boolean().optional(),
  minWaterBlocks: z.number().optional(),
  area: z.object({
    start: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number()
    }),
    end: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number()
    })
  }),
  maxRetries: z.number().optional(),
  quantity: z.number().optional(),
  retryDelay: z.number().optional(),
  timeout: z.number().optional(),
  useML: z.boolean().optional(),
  usePathfinding: z.boolean().optional(),
  waterSources: z.array(z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  })).optional()
}).strict();

const inventorySchema = z.object({
  operation: z.enum(['check', 'count', 'sort']),
  itemType: z.string().optional(),
  quantity: z.number().optional()
}).strict();

const querySchema = z.object({
  queryType: z.enum(['inventory', 'block', 'entity', 'biome', 'time', 'position']),
  description: z.string().optional(),
  filters: z.object({
    minCount: z.number().optional(),
    maxCount: z.number().optional(),
    radius: z.number().optional(),
    blockType: z.string().optional()
  }).optional(),
  useML: z.boolean().optional()
}).strict();

const gatheringSchema = z.object({
  itemType: z.string(),
  quantity: z.number().optional(),
  radius: z.number().optional(),
  spacing: z.number().optional(),
  usePathfinding: z.boolean().optional(),
  avoidWater: z.boolean().optional()
}).strict();

const craftingSchema = z.object({
  recipe: z.string(),
  materials: z.array(z.string()).optional()
}).strict();

const combatSchema = z.object({
  targetType: z.enum(['player', 'mob']),
  targetName: z.string().optional(),
  followDistance: z.number().optional(),
  weaponSlot: z.number().optional()
}).strict();

const interactionSchema = z.object({
  type: z.enum(['use', 'place', 'break']),
  target: z.string(),
  item: z.string().optional()
}).strict();

const healingSchema = z.object({
  type: z.enum(['food', 'potion']),
  item: z.string().optional(),
  threshold: z.number().optional()
}).strict();

const unknownSchema = z.object({
  action: z.string(),
  parameters: z.record(z.any())
}).strict();

const commandDefinitions: Record<TaskType, CommandDefinition> = {
  [TaskType.CHAT]: {
    name: 'chat',
    description: 'Send a chat message',
    parameters: chatSchema as z.ZodType<TaskParameters>
  },
  [TaskType.MINING]: {
    name: 'mining',
    description: 'Mine blocks',
    parameters: miningSchema as z.ZodType<TaskParameters>
  },
  [TaskType.NAVIGATION]: {
    name: 'navigation',
    description: 'Navigate to a location',
    parameters: navigationSchema as z.ZodType<TaskParameters>
  },
  [TaskType.FARMING]: {
    name: 'farming',
    description: 'Farm crops',
    parameters: farmingSchema as z.ZodType<TaskParameters>
  },
  [TaskType.INVENTORY]: {
    name: 'inventory',
    description: 'Manage inventory',
    parameters: inventorySchema as z.ZodType<TaskParameters>
  },
  [TaskType.QUERY]: {
    name: 'query',
    description: 'Query information',
    parameters: querySchema as z.ZodType<TaskParameters>
  },
  [TaskType.GATHERING]: {
    name: 'gathering',
    description: 'Gather resources',
    parameters: gatheringSchema as z.ZodType<TaskParameters>
  },
  [TaskType.CRAFTING]: {
    name: 'crafting',
    description: 'Craft items',
    parameters: craftingSchema as z.ZodType<TaskParameters>
  },
  [TaskType.COMBAT]: {
    name: 'combat',
    description: 'Engage in combat',
    parameters: combatSchema as z.ZodType<TaskParameters>
  },
  [TaskType.INTERACTION]: {
    name: 'interaction',
    description: 'Interact with blocks or items',
    parameters: interactionSchema as z.ZodType<TaskParameters>
  },
  [TaskType.HEALING]: {
    name: 'healing',
    description: 'Heal the bot',
    parameters: healingSchema as z.ZodType<TaskParameters>
  },
  [TaskType.UNKNOWN]: {
    name: 'unknown',
    description: 'Handle unknown commands',
    parameters: unknownSchema as z.ZodType<TaskParameters>
  }
};

export const getCommandDefinition = (taskType: TaskType): CommandDefinition | undefined => {
  return commandDefinitions[taskType];
};

export const validateCommandParameters = (taskType: TaskType, parameters: any): TaskParameters | null => {
  const definition = getCommandDefinition(taskType);
  if (!definition) {
    return null;
  }

  try {
    return definition.parameters.parse(parameters) as TaskParameters;
  } catch (error) {
    console.error('Parameter validation failed:', error);
    return null;
  }
}; 