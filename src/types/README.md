# Type Definitions

This directory contains TypeScript type definitions used throughout the Minecraft bot application.

## Components

### `bot.ts`
- Bot types
- Event types
- State types
- Configuration types

### `task.ts`
- Task types
- Parameter types
- Dependency types
- Validation types

### `inventory.ts`
- Item types
- Container types
- Equipment types
- Storage types

### `world.ts`
- Block types
- Entity types
- Chunk types
- World state types

### `llm.ts`
- LLM types
- Response types
- Context types
- Error types

### `web.ts`
- API types
- Socket types
- Request types
- Response types

## Type Definitions

### Bot Types
```typescript
interface BotConfig {
  host: string;
  port: number;
  username: string;
  version: string;
  auth: 'mojang' | 'microsoft' | 'offline';
}

interface BotState {
  position: Vec3;
  health: number;
  food: number;
  inventory: InventoryState;
}
```

### Task Types
```typescript
interface Task {
  type: string;
  parameters: Record<string, any>;
  priority: number;
  timeout: number;
  retry: RetryConfig;
}

interface TaskResult {
  success: boolean;
  error?: string;
  data?: any;
}
```

### Inventory Types
```typescript
interface Item {
  type: string;
  count: number;
  metadata?: number;
  nbt?: any;
}

interface Container {
  type: string;
  slots: Item[];
  position: Vec3;
}
```

### World Types
```typescript
interface Block {
  type: string;
  position: Vec3;
  metadata?: number;
  state?: any;
}

interface Entity {
  type: string;
  position: Vec3;
  velocity: Vec3;
  metadata?: any;
}
```

### LLM Types
```typescript
interface LLMResponse {
  type: string;
  parameters: Record<string, any>;
  confidence: number;
  alternatives?: Alternative[];
}

interface LLMContext {
  world: WorldState;
  bot: BotState;
  history: CommandHistory;
}
```

### Web Types
```typescript
interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
}
```

## Usage

```typescript
import { BotConfig } from './bot';
import { Task } from './task';
import { Item } from './inventory';
import { Block } from './world';
import { LLMResponse } from './llm';
import { WebSocketMessage } from './web';

// Bot configuration
const config: BotConfig = {
  host: 'localhost',
  port: 25565,
  username: 'bot',
  version: '1.20.1',
  auth: 'offline'
};

// Task definition
const task: Task = {
  type: 'mining',
  parameters: { block: 'diamond_ore', quantity: 5 },
  priority: 50,
  timeout: 30000,
  retry: { maxAttempts: 3 }
};

// Item handling
const item: Item = {
  type: 'diamond',
  count: 64,
  metadata: 0
};

// Block interaction
const block: Block = {
  type: 'diamond_ore',
  position: { x: 100, y: 64, z: -200 },
  metadata: 0
};

// LLM response
const response: LLMResponse = {
  type: 'mining',
  parameters: { block: 'diamond_ore' },
  confidence: 0.95
};

// WebSocket message
const message: WebSocketMessage = {
  type: 'status',
  data: { position: { x: 0, y: 64, z: 0 } },
  timestamp: Date.now()
};
```

## Dependencies

- `mineflayer` - Bot types
- `prismarine-block` - Block types
- `prismarine-entity` - Entity types
- `prismarine-item` - Item types 