import { Inventory } from '../inventory';

export interface MLInventoryConverter {
  convertToMLInventory(inventory: Inventory): MLInventory;
}

export interface MLInventory {
  items: MLItem[];
  size: number;
}

export interface MLItem {
  type: string;
  quantity: number;
  metadata: {
    durability: number | undefined;
    enchantments: any[] | undefined;
    nbt: any | undefined;
  };
} 