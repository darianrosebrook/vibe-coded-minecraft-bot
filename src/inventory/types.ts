export interface Item {
  type: string;
  quantity: number;
}

export interface Inventory {
  items: Item[];
} 