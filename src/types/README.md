# Type System Documentation

This directory contains all type definitions for the Minecraft bot project. The types are organized into several categories for better maintainability and clarity.

## Directory Structure

```
src/types/
├── README.md                 # This documentation file
├── index.ts                  # Main type exports
├── common.ts                 # Common types used across the project
├── task.ts                   # Task-related types
├── bot/                      # Bot-specific types
├── core/                     # Core system types
├── inventory/                # Inventory management types
├── ml/                       # Machine Learning types
├── declarations/             # Type declaration files (.d.ts)
│   ├── mineflayer.d.ts       # Mineflayer type declarations
│   ├── mineflayer-pvp.d.ts   # PvP plugin type declarations
│   ├── mineflayer-auto-eat.d.ts # Auto-eat plugin type declarations
│   ├── node-gzip.d.ts        # Gzip compression type declarations
│   └── ml-packages.d.ts      # ML package type declarations
└── modules/                  # Module-specific types
    ├── tool.ts               # Tool-related types
    ├── world.ts              # World interaction types
    ├── context.ts            # Context management types
    ├── hotspot.ts            # Hotspot detection types
    ├── config.ts             # Configuration types
    └── plugin.ts             # Plugin system types
```

## Type Categories

### Common Types (`common.ts`)
Contains types that are used across multiple modules, such as:
- Position coordinates
- Error handling (ErrorCategory, ErrorContext, ErrorSeverity)
- Basic data structures
- Fallback and Retry strategies

### Bot Types (`bot/`)
Types specific to bot behavior and control:
- Bot configuration
- Movement patterns
- State management

### Core Types (`core/`)
Fundamental system types:
- Position handling
- Error definitions
- Basic utilities

### Inventory Types (`inventory/`)
Types for inventory management:
- Item handling
- Storage systems
- Resource tracking
- Inventory categories and slots

### ML Types (`ml/`)
Machine Learning related types:
- Command processing
- Mining operations
- State management (MiningMLState, RedstoneMLState, ChatMLState)
- Performance tracking
- Model definitions
- Redstone and chat-specific ML types

### Module Types (`modules/`)
Types specific to individual modules:
- Tool management
- World interaction
- Context handling
- Hotspot detection
- Configuration
- Plugin system

### Declaration Files (`declarations/`)
Type declaration files for external dependencies:
- Mineflayer and its plugins (pvp, auto-eat)
- Node-gzip compression
- ML packages

## Type Exports

The main `index.ts` file exports all types in an organized manner:

```typescript
// Core types
export * from './core/position';
export * from './core/error';

// Bot types
export * from './bot/config';

// Inventory types
export { InventoryCategory, InventorySlot } from './inventory/inventory';
export * from './inventory/inventory';

// ML types
export * from './ml/performance';
export * from './ml/model';
export { MiningMLState, RedstoneMLState, ChatMLState, StateValidation } from './ml/state';
export * from './ml/command';
export * from './ml/mining';
export * from './ml/redstone';
export * from './ml/chat';

// Task types
export * from './task';

// Module types
export * from './modules/config';
export * from './modules/tool';
export * from './modules/plugin';
export * from './modules/world';
export * from './modules/hotspot';
export * from './modules/context';

// Common types
export { ErrorCategory, ErrorContext, ErrorSeverity, FallbackStrategy, RetryStrategy, Position } from './common';
export * from './common';
```

## Usage Guidelines

1. **Type Organization**
   - Place types in the most specific category that makes sense
   - If a type is used across multiple categories, place it in `common.ts`
   - Keep related types together in the same file

2. **Type Declarations**
   - External type declarations go in `declarations/`
   - Use `.d.ts` extension for declaration files
   - Keep declarations minimal and focused

3. **Module Types**
   - Place module-specific types in `modules/`
   - Name files after their primary purpose
   - Include JSDoc comments for all types

4. **Documentation**
   - Add JSDoc comments to all types
   - Include usage examples where helpful
   - Document any special considerations

## Best Practices

1. **Type Naming**
   - Use PascalCase for type names
   - Be descriptive but concise
   - Use consistent naming patterns

2. **Type Organization**
   - Group related types together
   - Use interfaces for object shapes
   - Use type aliases for unions and intersections

3. **Documentation**
   - Document all exported types
   - Include examples for complex types
   - Explain any non-obvious behavior

4. **Maintenance**
   - Keep types up to date with code changes
   - Remove unused types
   - Refactor when types become too complex

## Type Validation

When working with types, consider the following validation patterns:

```typescript
// Type guard example
function isMiningTask(task: Task): task is Task & { parameters: MiningTaskParameters } {
  return task.type === TaskType.MINING;
}

// Type assertion example
const miningTask = task as Task & { parameters: MiningTaskParameters };

// Type checking example
if (task.type === TaskType.MINING) {
  // TypeScript knows task.parameters is MiningTaskParameters
}
```

## Common Patterns

1. **Task Creation**
   ```typescript
   const task: Task = {
     id: 'unique-id',
     type: TaskType.MINING,
     parameters: {
       targetBlock: 'iron_ore',
       quantity: 32
     },
     priority: 50,
     status: TaskStatus.PENDING
   };
   ```

2. **Error Handling**
   ```typescript
   try {
     // Task execution
   } catch (error) {
     if (error instanceof BotError) {
       // Handle bot-specific error
     }
   }
   ```

3. **Position Calculations**
   ```typescript
   const distance = (pos1: Position, pos2: Position): number => {
     return Math.sqrt(
       Math.pow(pos2.x - pos1.x, 2) +
       Math.pow(pos2.y - pos1.y, 2) +
       Math.pow(pos2.z - pos1.z, 2)
     );
   };
   ``` 