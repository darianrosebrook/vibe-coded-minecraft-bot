export interface ToolRecipe {
  name: string;
  type: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe';
  material: 'wooden' | 'stone' | 'iron' | 'golden' | 'diamond' | 'netherite';
  ingredients: {
    [key: string]: number; // item name -> quantity
  };
  craftingTable: boolean;
}

export const toolRecipes: ToolRecipe[] = [
  {
    name: 'wooden_pickaxe',
    type: 'pickaxe',
    material: 'wooden',
    ingredients: {
      'planks': 3,
      'stick': 2
    },
    craftingTable: true
  },
  {
    name: 'stone_pickaxe',
    type: 'pickaxe',
    material: 'stone',
    ingredients: {
      'cobblestone': 3,
      'stick': 2
    },
    craftingTable: true
  },
  {
    name: 'iron_pickaxe',
    type: 'pickaxe',
    material: 'iron',
    ingredients: {
      'iron_ingot': 3,
      'stick': 2
    },
    craftingTable: true
  },
  {
    name: 'diamond_pickaxe',
    type: 'pickaxe',
    material: 'diamond',
    ingredients: {
      'diamond': 3,
      'stick': 2
    },
    craftingTable: true
  },
  {
    name: 'netherite_pickaxe',
    type: 'pickaxe',
    material: 'netherite',
    ingredients: {
      'netherite_ingot': 1,
      'diamond_pickaxe': 1
    },
    craftingTable: true
  },
  // Add more tool recipes as needed
];

export const materialRequirements: { [key: string]: string[] } = {
  'wooden': ['planks', 'stick'],
  'stone': ['cobblestone', 'stick'],
  'iron': ['iron_ingot', 'stick'],
  'golden': ['gold_ingot', 'stick'],
  'diamond': ['diamond', 'stick'],
  'netherite': ['netherite_ingot', 'diamond_tool']
}; 