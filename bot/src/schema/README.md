# Schema Validation

This directory contains JSON schemas and validation logic for the Minecraft bot, ensuring data integrity and type safety across the application.

## Components

### `taskSchema.ts`
- Task definition schemas
- Parameter validation
- Dependency validation
- Requirement validation

### `configSchema.ts`
- Configuration schemas
- Environment validation
- Setting validation
- Default value schemas

### `responseSchema.ts`
- LLM response schemas
- Command validation
- Error response schemas
- Status schemas

### `worldSchema.ts`
- World state schemas
- Block schemas
- Entity schemas
- Chunk schemas

## Schema Types

### Task Schema
```typescript
interface TaskSchema {
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

### Configuration Schema
```typescript
interface ConfigSchema {
  bot: BotConfig;
  llm: LLMConfig;
  tasks: TaskConfig;
  storage: StorageConfig;
  web: WebConfig;
}
```

### Response Schema
```typescript
interface ResponseSchema {
  type: string;
  parameters: Record<string, any>;
  confidence: number;
  alternatives?: Alternative[];
  error?: ErrorInfo;
}
```

## Usage

```typescript
import { validateTask } from './taskSchema';
import { validateConfig } from './configSchema';
import { validateResponse } from './responseSchema';

// Validate task
const task = {
  type: 'mining',
  parameters: { block: 'diamond_ore', quantity: 5 }
};
const validTask = validateTask(task);

// Validate configuration
const config = {
  bot: { host: 'localhost', port: 25565 },
  llm: { model: 'llama2' }
};
const validConfig = validateConfig(config);

// Validate response
const response = {
  type: 'mining',
  parameters: { block: 'diamond_ore' }
};
const validResponse = validateResponse(response);
```

## Validation Rules

### Task Validation
- Required fields
- Parameter types
- Dependency cycles
- Resource requirements

### Configuration Validation
- Environment variables
- Setting ranges
- Required settings
- Default values

### Response Validation
- Response structure
- Parameter validation
- Error handling
- Alternative validation

## Dependencies

- `zod` - Schema validation
- `ajv` - JSON schema validation
- `winston` - Logging 