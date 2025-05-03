import { z } from 'zod';

// Base task type schema
export const baseTaskTypeSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(['action', 'query', 'management']),
  priority: z.number().min(0).max(100),
  requiresContext: z.boolean(),
  validationRules: z.array(z.string())
});

// Task type hierarchy
export const taskTypeHierarchy = {
  // Action tasks
  mining: {
    name: 'mining',
    description: 'Mine or collect blocks',
    category: 'action',
    priority: 80,
    requiresContext: true,
    validationRules: ['hasValidBlock', 'hasValidQuantity', 'hasValidTool'],
    subTypes: {
      stripMining: {
        name: 'stripMining',
        description: 'Mine in a straight line',
        priority: 85,
        validationRules: ['hasValidDirection', 'hasValidLength']
      },
      branchMining: {
        name: 'branchMining',
        description: 'Mine in a branching pattern',
        priority: 85,
        validationRules: ['hasValidPattern', 'hasValidSpacing']
      }
    }
  },
  crafting: {
    name: 'crafting',
    description: 'Craft items',
    category: 'action',
    priority: 70,
    requiresContext: true,
    validationRules: ['hasValidRecipe', 'hasValidMaterials'],
    subTypes: {
      toolCrafting: {
        name: 'toolCrafting',
        description: 'Craft tools',
        priority: 75,
        validationRules: ['hasValidToolType', 'hasValidMaterial']
      },
      blockCrafting: {
        name: 'blockCrafting',
        description: 'Craft blocks',
        priority: 70,
        validationRules: ['hasValidBlockType', 'hasValidQuantity']
      }
    }
  },
  navigation: {
    name: 'navigation',
    description: 'Move to locations',
    category: 'action',
    priority: 60,
    requiresContext: true,
    validationRules: ['hasValidDestination', 'hasValidPath'],
    subTypes: {
      exploration: {
        name: 'exploration',
        description: 'Explore new areas',
        priority: 65,
        validationRules: ['hasValidArea', 'hasValidStrategy']
      },
      returnHome: {
        name: 'returnHome',
        description: 'Return to home location',
        priority: 70,
        validationRules: ['hasValidHomeLocation']
      }
    }
  },
  // Query tasks
  inventory: {
    name: 'inventory',
    description: 'Query inventory state',
    category: 'query',
    priority: 50,
    requiresContext: true,
    validationRules: ['hasValidQueryType'],
    subTypes: {
      itemQuery: {
        name: 'itemQuery',
        description: 'Query specific items',
        priority: 55,
        validationRules: ['hasValidItemType']
      },
      equipmentQuery: {
        name: 'equipmentQuery',
        description: 'Query equipment state',
        priority: 55,
        validationRules: ['hasValidEquipmentType']
      }
    }
  },
  // Management tasks
  inventoryManagement: {
    name: 'inventoryManagement',
    description: 'Manage inventory',
    category: 'management',
    priority: 40,
    requiresContext: true,
    validationRules: ['hasValidAction', 'hasValidTarget'],
    subTypes: {
      organize: {
        name: 'organize',
        description: 'Organize inventory',
        priority: 45,
        validationRules: ['hasValidOrganizationPattern']
      },
      cleanup: {
        name: 'cleanup',
        description: 'Clean up inventory',
        priority: 45,
        validationRules: ['hasValidCleanupRules']
      }
    }
  }
};

// Type validation functions
export const typeValidationFunctions = {
  hasValidBlock: (params: any) => {
    return typeof params.block === 'string' && params.block.length > 0;
  },
  hasValidQuantity: (params: any) => {
    return typeof params.quantity === 'number' && params.quantity > 0;
  },
  hasValidTool: (params: any) => {
    return typeof params.tool === 'string' && params.tool.length > 0;
  },
  hasValidDirection: (params: any) => {
    return ['north', 'south', 'east', 'west'].includes(params.direction);
  },
  hasValidLength: (params: any) => {
    return typeof params.length === 'number' && params.length > 0;
  },
  hasValidPattern: (params: any) => {
    return ['straight', 'zigzag', 'spiral'].includes(params.pattern);
  },
  hasValidSpacing: (params: any) => {
    return typeof params.spacing === 'number' && params.spacing >= 2;
  },
  hasValidRecipe: (params: any) => {
    return typeof params.recipe === 'string' && params.recipe.length > 0;
  },
  hasValidMaterials: (params: any) => {
    return Array.isArray(params.materials) && params.materials.length > 0;
  },
  hasValidToolType: (params: any) => {
    return ['pickaxe', 'axe', 'shovel', 'hoe', 'sword'].includes(params.toolType);
  },
  hasValidMaterial: (params: any) => {
    return ['wood', 'stone', 'iron', 'gold', 'diamond'].includes(params.material);
  },
  hasValidBlockType: (params: any) => {
    return typeof params.blockType === 'string' && params.blockType.length > 0;
  },
  hasValidDestination: (params: any) => {
    return typeof params.destination === 'object' && 
           typeof params.destination.x === 'number' &&
           typeof params.destination.y === 'number' &&
           typeof params.destination.z === 'number';
  },
  hasValidPath: (params: any) => {
    return Array.isArray(params.path) && params.path.length > 0;
  },
  hasValidArea: (params: any) => {
    return typeof params.area === 'object' && 
           typeof params.area.radius === 'number' &&
           params.area.radius > 0;
  },
  hasValidStrategy: (params: any) => {
    return ['random', 'spiral', 'grid'].includes(params.strategy);
  },
  hasValidHomeLocation: (params: any) => {
    return typeof params.homeLocation === 'object' && 
           typeof params.homeLocation.x === 'number' &&
           typeof params.homeLocation.y === 'number' &&
           typeof params.homeLocation.z === 'number';
  },
  hasValidQueryType: (params: any) => {
    return ['items', 'equipment', 'materials'].includes(params.queryType);
  },
  hasValidItemType: (params: any) => {
    return typeof params.itemType === 'string' && params.itemType.length > 0;
  },
  hasValidEquipmentType: (params: any) => {
    return ['armor', 'tools', 'weapons'].includes(params.equipmentType);
  },
  hasValidAction: (params: any) => {
    return ['organize', 'cleanup', 'sort'].includes(params.action);
  },
  hasValidTarget: (params: any) => {
    return typeof params.target === 'string' && params.target.length > 0;
  },
  hasValidOrganizationPattern: (params: any) => {
    return ['byType', 'byMaterial', 'byUse'].includes(params.pattern);
  },
  hasValidCleanupRules: (params: any) => {
    return Array.isArray(params.rules) && params.rules.length > 0;
  }
};

// Type validation helper functions
export function getTaskType(type: string) {
  return taskTypeHierarchy[type as keyof typeof taskTypeHierarchy];
}

export function getSubType(type: string, subType: string) {
  const taskType = getTaskType(type);
  return taskType?.subTypes?.[subType as keyof typeof taskType.subTypes];
}

export function validateTaskType(type: string, params: any): { valid: boolean; errors: string[] } {
  const taskType = getTaskType(type);
  if (!taskType) {
    return { valid: false, errors: [`Invalid task type: ${type}`] };
  }

  const errors: string[] = [];
  for (const rule of taskType.validationRules) {
    if (!typeValidationFunctions[rule as keyof typeof typeValidationFunctions](params)) {
      errors.push(`Failed validation rule: ${rule}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateSubType(type: string, subType: string, params: any): { valid: boolean; errors: string[] } {
  if (!type || !subType) {
    return { valid: false, errors: ['Type and sub-type are required'] };
  }

  const subTypeDef = getSubType(type, subType);
  if (!subTypeDef) {
    return { valid: false, errors: [`Invalid sub-type: ${subType} for type: ${type}`] };
  }

  const errors: string[] = [];
  const validationRules = (subTypeDef as any).validationRules || [];
  for (const rule of validationRules) {
    const validator = typeValidationFunctions[rule as keyof typeof typeValidationFunctions];
    if (!validator || !validator(params)) {
      errors.push(`Failed validation rule: ${rule}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
} 