export interface Item {
  name: string;
  count: number;
  metadata?: number;
  nbt?: Record<string, any>;
  durability?: number;
  enchantments?: Array<{
    name: string;
    level: number;
  }>;
}

 
export interface Inventory {
  items: Item[];
  size: number;
  type: string;
  title?: string;
  slots: Array<{
    index: number;
    item: Item | null;
  }>;
}

export interface InventoryCategory {
  name: string;
  slots: number[];
  priority: number;
  filter?: {
    items: string[];
    maxQuantity?: number;
  };
}

export interface InventorySlot {
  slot: number;
  item: Item | null;
}

export interface InventoryOperation {
  type: 'move' | 'swap' | 'drop' | 'collect';
  source: {
    inventory: string;
    slot: number;
  };
  target: {
    inventory: string;
    slot: number;
  };
  item: Item;
  quantity: number;
} 