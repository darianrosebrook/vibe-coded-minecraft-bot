import { z } from 'zod';

/**
 * Configuration version enum
 * @remarks Used to track and validate configuration format versions
 */
export enum ConfigVersion {
  /** Initial configuration format */
  V1_0_0 = '1.0.0',
  /** Updated configuration format with additional features */
  V1_1_0 = '1.1.0',
  /** Current configuration version */
  CURRENT = V1_1_0
}

/**
 * Base configuration schema using Zod for runtime validation
 * @remarks Defines all configurable parameters for the bot
 */
export const baseConfigSchema = z.object({
  // Server configuration
  /** Minecraft server hostname or IP address */
  MINECRAFT_HOST: z.string().default('localhost'),
  /** Minecraft server port number */
  MINECRAFT_PORT: z.number().default(25565),
  /** Username for Minecraft authentication */
  MINECRAFT_USERNAME: z.string(),
  /** Password for Minecraft authentication (optional) */
  MINECRAFT_PASSWORD: z.string().optional(),
  /** Minecraft version to connect with */
  MINECRAFT_VERSION: z.string().default('1.21.4'),

  // Web server configuration
  /** Web server port number */
  WEB_PORT: z.number().default(3000),
  /** Web server hostname */
  WEB_HOSTNAME: z.string().default('localhost'),
  /** Whether to run in development mode */
  NODE_ENV: z.string().default('production'),

  // Bot settings
  /** Command prefix for bot commands */
  BOT_PREFIX: z.string().default('.bot'),
  /** Maximum view distance in chunks */
  BOT_VIEW_DISTANCE: z.number().default(4),
  /** Maximum chat interaction distance */
  BOT_CHAT_DISTANCE: z.number().default(16),
  /** Whether to run in safe mode (restricted actions) */
  BOT_SAFE_MODE: z.boolean().default(true),

  // LLM settings
  /** Host URL for the Ollama LLM service */
  OLLAMA_HOST: z.string().default('http://localhost:11434'),
  /** Model name to use for LLM operations */
  OLLAMA_MODEL: z.string().default('llama3.2:1b'),
  /** Temperature setting for LLM generation (0-1) */
  OLLAMA_TEMPERATURE: z.number().default(0.7),
  /** Maximum tokens for LLM responses */
  OLLAMA_MAX_TOKENS: z.number().default(1000),

  // Storage settings
  /** Path to store persistent data */
  STORAGE_PATH: z.string().default('./data'),
  /** Maximum age of stored data in milliseconds */
  STORAGE_MAX_AGE: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
  /** Maximum age of completed tasks in milliseconds */
  STORAGE_MAX_COMPLETED_AGE: z.number().default(30 * 24 * 60 * 60 * 1000), // 30 days
  /** Interval for storage cleanup in milliseconds */
  STORAGE_CLEANUP_INTERVAL: z.number().default(24 * 60 * 60 * 1000), // 24 hours
  /** Maximum number of historical records to keep */
  STORAGE_MAX_HISTORY: z.number().default(1000),

  // Logging settings
  /** Minimum log level to record */
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  /** Format for log output */
  LOG_FORMAT: z.enum(['json', 'text']).default('json'),
  /** Directory to store log files */
  LOG_PATH: z.string().default('./logs'),
  /** Maximum size of a log file in bytes */
  LOG_MAX_SIZE: z.number().default(10 * 1024 * 1024), // 10MB
  /** Maximum number of log files to keep */
  LOG_MAX_FILES: z.number().default(5),

  // Metrics settings
  /** Whether to enable metrics collection */
  METRICS_ENABLED: z.boolean().default(true),
  /** Port for metrics server */
  METRICS_PORT: z.number().default(9090),
  /** Prefix for metric names */
  METRICS_PREFIX: z.string().default('minecraft_bot_'),

  // Feature flags
  /** Whether to enable automatic eating */
  FEATURE_AUTO_EAT: z.boolean().default(true),
  /** Whether to enable automatic item collection */
  FEATURE_AUTO_COLLECT: z.boolean().default(true),
  /** Whether to enable pathfinding */
  FEATURE_PATHFINDING: z.boolean().default(true),
  /** Whether to enable world state tracking */
  FEATURE_WORLD_TRACKING: z.boolean().default(true),

  // Version tracking
  /** Current configuration version */
  CONFIG_VERSION: z.nativeEnum(ConfigVersion).default(ConfigVersion.CURRENT)
});

/**
 * Type representing the complete configuration
 * @remarks Inferred from the baseConfigSchema
 */
export type Config = z.infer<typeof baseConfigSchema>;

/**
 * Callback type for configuration changes
 * @param config - The new configuration
 */
export type ConfigChangeCallback = (config: Config) => void | Promise<void>; 