# Error Handling

This directory contains the error handling system for the Minecraft bot, including error categorization, recovery strategies, and logging.

## Components

### `errorHandler.ts`
- Error categorization
- Recovery strategies
- Error logging
- Error reporting

### `errorTypes.ts`
- Custom error classes
- Error type definitions
- Error severity levels
- Error categories

### `recovery.ts`
- Recovery strategies
- Fallback mechanisms
- Retry logic
- State restoration

## Error Categories

### Network Errors
- Connection issues
- Server disconnects
- Timeout errors
- Protocol errors

### Pathfinding Errors
- Navigation failures
- Blocked paths
- Entity collisions
- World boundary issues

### Inventory Errors
- Full inventory
- Item management
- Storage access
- Item transfer

### Block Interaction Errors
- Mining failures
- Placement errors
- Breaking issues
- Block access

### Entity Interaction Errors
- Mob interactions
- Player interactions
- Entity tracking
- Combat issues

### LLM Errors
- API failures
- Response parsing
- Context errors
- Model issues

## Recovery Strategies

### Network Recovery
- Automatic reconnection
- Connection retry
- Server switching
- Protocol fallback

### Pathfinding Recovery
- Alternative paths
- Obstacle avoidance
- Path recalculation
- Movement adjustment

### Inventory Recovery
- Item dropping
- Storage management
- Inventory sorting
- Space creation

## Usage

```typescript
import { ErrorHandler } from './errorHandler';
import { NetworkError } from './errorTypes';

try {
  // Bot operation
} catch (error) {
  const handler = new ErrorHandler();
  const recovery = handler.handle(error);
  
  if (recovery) {
    await recovery.execute();
  }
}
```

## Error Schema

```typescript
interface BotError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  context: ErrorContext;
  timestamp: number;
  stack?: string;
}
```

## Dependencies

- `winston` - Logging
- `zod` - Error schema validation
- `immer` - State management 