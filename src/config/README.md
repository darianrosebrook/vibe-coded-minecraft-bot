# Configuration Management

This directory handles the configuration management for the Minecraft bot, including environment settings, validation, and dynamic updates.

## Components

### `config.ts`
- Configuration loading
- Environment variable handling
- Default value management
- Configuration validation

### `schema.ts`
- Configuration schemas
- Type definitions
- Validation rules
- Default values

### `env.ts`
- Environment variable parsing
- .env file handling
- Environment-specific settings
- Secret management

## Configuration Structure

### Bot Configuration
```typescript
interface BotConfig {
  host: string;
  port: number;
  username: string;
  version: string;
  auth: 'mojang' | 'microsoft' | 'offline';
  viewDistance: number;
  chatLengthLimit: number;
}
```

### LLM Configuration
```typescript
interface LLMConfig {
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
}
```

### Task Configuration
```typescript
interface TaskConfig {
  maxConcurrent: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}
```

## Environment Variables

Required environment variables:
- `MINECRAFT_HOST` - Minecraft server host
- `MINECRAFT_PORT` - Minecraft server port
- `BOT_USERNAME` - Bot's username
- `LLM_MODEL` - LLM model name
- `LLM_BASE_URL` - LLM API base URL

Optional environment variables:
- `VIEW_DISTANCE` - Bot's view distance
- `CHAT_LENGTH_LIMIT` - Maximum chat length
- `TASK_TIMEOUT` - Task timeout in milliseconds
- `LOG_LEVEL` - Logging level

## Usage

```typescript
import { loadConfig } from './config';
import { validateConfig } from './schema';

const config = await loadConfig();
const validatedConfig = validateConfig(config);

// Access configuration
console.log(`Connecting to ${validatedConfig.bot.host}:${validatedConfig.bot.port}`);
```

## Configuration Validation

Configuration is validated using Zod schemas:
```typescript
import { z } from 'zod';

const botConfigSchema = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  username: z.string().min(1),
  // ... other fields
});
```

## Dependencies

- `zod` - Schema validation
- `dotenv` - Environment variable handling
- `winston` - Logging 