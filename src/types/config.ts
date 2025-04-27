import { z } from 'zod';

// Configuration version enum
export enum ConfigVersion {
  V1_0_0 = '1.0.0',
  V1_1_0 = '1.1.0',
  CURRENT = V1_1_0
}

// Base configuration schema
export const baseConfigSchema = z.object({
  // Server configuration
  MINECRAFT_HOST: z.string().default('localhost'),
  MINECRAFT_PORT: z.number().default(25565),
  MINECRAFT_USERNAME: z.string(),
  MINECRAFT_PASSWORD: z.string().optional(),
  MINECRAFT_VERSION: z.string().default('1.20.1'),

  // Bot settings
  BOT_PREFIX: z.string().default('.bot'),
  BOT_VIEW_DISTANCE: z.number().default(4),
  BOT_CHAT_DISTANCE: z.number().default(16),
  BOT_SAFE_MODE: z.boolean().default(true),

  // LLM settings
  OLLAMA_HOST: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.2:1b'),
  OLLAMA_TEMPERATURE: z.number().default(0.7),
  OLLAMA_MAX_TOKENS: z.number().default(1000),

  // Storage settings
  STORAGE_PATH: z.string().default('./data'),
  STORAGE_MAX_AGE: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
  STORAGE_MAX_COMPLETED_AGE: z.number().default(30 * 24 * 60 * 60 * 1000), // 30 days
  STORAGE_CLEANUP_INTERVAL: z.number().default(24 * 60 * 60 * 1000), // 24 hours
  STORAGE_MAX_HISTORY: z.number().default(1000),

  // Logging settings
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('json'),
  LOG_PATH: z.string().default('./logs'),
  LOG_MAX_SIZE: z.number().default(10 * 1024 * 1024), // 10MB
  LOG_MAX_FILES: z.number().default(5),

  // Metrics settings
  METRICS_ENABLED: z.boolean().default(true),
  METRICS_PORT: z.number().default(9090),
  METRICS_PREFIX: z.string().default('minecraft_bot_'),

  // Feature flags
  FEATURE_AUTO_EAT: z.boolean().default(true),
  FEATURE_AUTO_COLLECT: z.boolean().default(true),
  FEATURE_PATHFINDING: z.boolean().default(true),
  FEATURE_WORLD_TRACKING: z.boolean().default(true),

  // Version tracking
  CONFIG_VERSION: z.nativeEnum(ConfigVersion).default(ConfigVersion.CURRENT)
});

// Export the configuration type
export type Config = z.infer<typeof baseConfigSchema>;

// Configuration change callback type
export type ConfigChangeCallback = (config: Config) => void | Promise<void>; 