# Task Management

This directory contains the task management system for the Minecraft bot, including task definitions, execution logic, and task queue management.

## Directory Structure

### `base.ts`
- Base task class implementation
- Common task functionality
- Progress tracking
- Error handling
- Retry mechanisms

### `mining.ts`
- Mining task implementation
- Resource discovery
- Tool selection
- Pathfinding integration

### `farming.ts`
- Farming task implementation
- Crop management
- Harvesting logic
- Replanting automation

### `navigation.ts`
- Navigation task implementation
- Pathfinding
- Movement optimization
- Obstacle avoidance

### `inventory.ts`
- Inventory management tasks
- Item sorting
- Storage optimization
- Resource tracking

### `redstone.ts`
- Redstone automation tasks
- Circuit management
- Device interaction
- Farm automation

### `queue/`
- Task queue implementation
- Priority management
- Dependency resolution
- Conflict handling

### `validation/`
- Task validation system
- Resource requirements
- Feasibility checks
- Pre/post execution validation

## Task Types

The system supports various task types:
- Mining
- Farming
- Navigation
- Inventory
- Redstone
- Crafting
- Gathering
- Processing
- Construction
- Exploration
- Storage
- Combat

## Usage

Tasks are created through the task factory and managed by the task queue:

```typescript
import { TaskFactory } from './factory';
import { TaskQueue } from './queue';

const task = TaskFactory.createTask({
  type: 'mining',
  parameters: {
    block: 'diamond_ore',
    quantity: 5
  }
});

const queue = new TaskQueue();
queue.addTask(task);
```

## Task Schema

Tasks follow a standardized JSON schema for validation and execution:

```typescript
interface Task {
  type: string;
  parameters: Record<string, any>;
  priority: number;
  timeout: number;
  retry: RetryConfig;
  requirements: Requirements;
  validation: ValidationRules;
  dependencies: Dependency[];
}
```

## Dependencies

- `bull` - Task queue management
- `graphlib` - Dependency graph processing
- `ajv` - JSON schema validation 