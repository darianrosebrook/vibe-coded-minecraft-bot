# Inventory Management

This directory handles inventory management for the Minecraft bot, including item tracking, storage optimization, and resource management.

## Components

### `inventory.ts`
- Inventory state tracking
- Item management
- Slot optimization
- Inventory events

### `storage.ts`
- Container management
- Item transfer
- Storage optimization
- Container events

### `crafting.ts`
- Crafting management
- Recipe validation
- Material tracking
- Crafting events

### `equipment.ts`
- Equipment management
- Tool selection
- Armor optimization
- Equipment events

## Features

### Inventory Tracking
- Real-time inventory state
- Item quantity tracking
- Slot management
- Event handling

### Storage Management
- Container interaction
- Item sorting
- Space optimization
- Transfer management

### Crafting System
- Recipe validation
- Material checking
- Crafting execution
- Result handling

### Equipment Management
- Tool selection
- Armor optimization
- Durability tracking
- Repair management

## Data Structures

### Inventory State
```typescript
interface InventoryState {
  items: Item[];
  selectedSlot: number;
  cursorItem?: Item;
  craftingSlots: Item[];
  armorSlots: Item[];
  offhandSlot?: Item;
}
```

### Container State
```typescript
interface ContainerState {
  type: string;
  slots: Item[];
  size: number;
  position: Vec3;
}
```

## Usage

```typescript
import { Inventory } from './inventory';
import { Storage } from './storage';
import { Crafting } from './crafting';

const inventory = new Inventory(bot);
const storage = new Storage(bot);
const crafting = new Crafting(bot);

// Track inventory
inventory.on('update', (state) => {
  console.log('Inventory updated:', state);
});

// Manage storage
await storage.transferItems(chest, {
  itemType: 'diamond',
  quantity: 64
});

// Handle crafting
await crafting.craftItem('diamond_pickaxe', 1);
```

## Events

### Inventory Events
- `update` - Inventory state change
- `itemAdd` - Item added
- `itemRemove` - Item removed
- `slotChange` - Slot changed

### Storage Events
- `open` - Container opened
- `close` - Container closed
- `update` - Container state change
- `transfer` - Item transfer

## Dependencies

- `mineflayer` - Bot framework
- `prismarine-item` - Item handling
- `winston` - Logging 