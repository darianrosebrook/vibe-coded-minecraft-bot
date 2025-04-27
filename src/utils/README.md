# Utility Functions

This directory contains general utility functions used throughout the Minecraft bot application.

## Components

### `math.ts`
- Vector operations
- Distance calculations
- Angle computations
- Random number generation

### `time.ts`
- Time formatting
- Duration calculations
- Timeout management
- Scheduling utilities

### `string.ts`
- String manipulation
- Text formatting
- Command parsing
- Message formatting

### `array.ts`
- Array operations
- Collection utilities
- Sorting functions
- Filtering helpers

### `object.ts`
- Object manipulation
- Deep merging
- Property access
- Type checking

### `promise.ts`
- Promise utilities
- Async operations
- Retry logic
- Timeout handling

## Functions

### Math Utilities
```typescript
function distance(a: Vec3, b: Vec3): number;
function angle(a: Vec3, b: Vec3): number;
function random(min: number, max: number): number;
```

### Time Utilities
```typescript
function formatDuration(ms: number): string;
function timeout(ms: number): Promise<void>;
function schedule(callback: () => void, interval: number): () => void;
```

### String Utilities
```typescript
function formatCommand(cmd: string, params: Record<string, any>): string;
function parseCommand(cmd: string): { command: string; params: Record<string, any> };
function formatMessage(msg: string, ...args: any[]): string;
```

### Array Utilities
```typescript
function chunk<T>(array: T[], size: number): T[][];
function unique<T>(array: T[]): T[];
function sortBy<T>(array: T[], key: keyof T): T[];
```

### Object Utilities
```typescript
function deepMerge<T>(target: T, source: Partial<T>): T;
function getProperty<T>(obj: any, path: string): T | undefined;
function isType<T>(value: any, type: string): value is T;
```

### Promise Utilities
```typescript
function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>;
function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T>;
function parallel<T>(tasks: (() => Promise<T>)[]): Promise<T[]>;
```

## Usage

```typescript
import { distance } from './math';
import { formatDuration } from './time';
import { formatCommand } from './string';
import { chunk } from './array';
import { deepMerge } from './object';
import { retry } from './promise';

// Calculate distance
const dist = distance(pos1, pos2);

// Format duration
const duration = formatDuration(3600000); // "1h"

// Format command
const cmd = formatCommand('mine', { block: 'diamond_ore', quantity: 5 });

// Chunk array
const chunks = chunk(items, 64);

// Merge objects
const merged = deepMerge(config, overrides);

// Retry operation
const result = await retry(async () => {
  // Operation that might fail
}, { maxAttempts: 3 });
```

## Dependencies

- `vec3` - Vector operations
- `winston` - Logging
- `zod` - Type validation 