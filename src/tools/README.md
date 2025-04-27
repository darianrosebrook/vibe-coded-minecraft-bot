# Tool Management

This directory handles tool management for the Minecraft bot, including tool selection, durability tracking, and optimization.

## Components

### `toolManager.ts`
- Tool selection
- Durability tracking
- Tool switching
- Repair management

### `toolTypes.ts`
- Tool type definitions
- Tool properties
- Tool requirements
- Tool capabilities

### `durability.ts`
- Durability tracking
- Wear calculation
- Repair detection
- Tool status

### `optimization.ts`
- Tool selection optimization
- Efficiency calculation
- Resource matching
- Tool hierarchy

## Features

### Tool Selection
- Automatic tool selection
- Tool type matching
- Material matching
- Efficiency calculation

### Durability Management
- Real-time durability tracking
- Wear prediction
- Repair detection
- Tool status monitoring

### Tool Optimization
- Best tool selection
- Resource matching
- Efficiency optimization
- Tool hierarchy management

### Repair System
- Repair detection
- Anvil usage
- Material requirements
- Repair cost calculation

## Data Structures

### Tool Definition
```typescript
interface Tool {
  type: string;
  material: string;
  durability: number;
  efficiency: number;
  enchantments: Enchantment[];
  position: number;
}
```

### Tool Requirements
```typescript
interface ToolRequirements {
  type: string;
  material?: string;
  minimumEfficiency?: number;
  requiredEnchantments?: string[];
  maxDurability?: number;
}
```

## Usage

```typescript
import { ToolManager } from './toolManager';
import { DurabilityTracker } from './durability';
import { ToolOptimizer } from './optimization';

const toolManager = new ToolManager(bot);
const durability = new DurabilityTracker(bot);
const optimizer = new ToolOptimizer(bot);

// Select best tool
const bestTool = await optimizer.selectBestTool('diamond_ore');

// Track durability
durability.on('wear', (tool, wear) => {
  console.log(`Tool ${tool.type} wore by ${wear}`);
});

// Manage tools
await toolManager.switchToTool('diamond_pickaxe');
```

## Tool Types

### Mining Tools
- Pickaxe
- Shovel
- Axe
- Hoe

### Combat Tools
- Sword
- Bow
- Crossbow
- Trident

### Utility Tools
- Shears
- Fishing rod
- Flint and steel
- Carrot on a stick

## Tool Properties

### Efficiency
- Wood: 2
- Stone: 4
- Iron: 6
- Diamond: 8
- Netherite: 9

### Durability
- Wood: 59
- Stone: 131
- Iron: 250
- Diamond: 1561
- Netherite: 2031

## Dependencies

- `mineflayer` - Bot framework
- `prismarine-item` - Item handling
- `winston` - Logging 