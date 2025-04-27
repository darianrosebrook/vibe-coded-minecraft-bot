# Data Persistence

This directory handles data persistence for the Minecraft bot, including task progress, world state, and configuration storage.

## Components

### `storage.ts`
- Data storage interface
- File system operations
- Data serialization
- Storage management

### `progress.ts`
- Task progress tracking
- Progress serialization
- Progress recovery
- Cleanup management

### `worldState.ts`
- World state persistence
- Chunk caching
- Block tracking
- Entity tracking

## Storage Types

### File System Storage
- JSON file storage
- Directory management
- File rotation
- Cleanup policies

### Memory Storage
- In-memory caching
- State management
- Cache invalidation
- Memory optimization

## Data Structures

### Progress Data
```typescript
interface ProgressData {
  taskId: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}
```

### World State
```typescript
interface WorldState {
  chunks: Record<string, ChunkData>;
  entities: Record<string, EntityData>;
  blocks: Record<string, BlockData>;
  timestamp: number;
}
```

## Usage

```typescript
import { Storage } from './storage';
import { ProgressTracker } from './progress';

const storage = new Storage({
  basePath: './data',
  cleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
});

const progress = new ProgressTracker(storage);

// Save progress
await progress.save({
  taskId: 'task-123',
  type: 'mining',
  status: 'running',
  progress: 0.5
});

// Load progress
const savedProgress = await progress.load('task-123');
```

## Cleanup Policies

- Progress files older than 7 days are deleted
- Failed tasks are kept for 3 days
- Completed tasks are kept for 30 days
- World state is cleaned up based on memory usage

## Dependencies

- `fs-extra` - File system operations
- `winston` - Logging
- `zod` - Data validation 