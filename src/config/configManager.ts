import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";
import {
  Config,
  ConfigVersion,
  ConfigChangeCallback,
  baseConfigSchema,
} from "@/types/modules/config";
import logger from "@/utils/observability/logger";

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private configPath: string;
  private changeCallbacks: Set<ConfigChangeCallback>;
  private isInitialized: boolean;
  private watchInterval: NodeJS.Timeout | null;

  private constructor() {
    this.config = {} as Config;
    this.configPath = "";
    this.changeCallbacks = new Set();
    this.isInitialized = false;
    this.watchInterval = null;
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public async initialize(configPath: string = ".env"): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Config manager already initialized");
      return;
    }

    this.configPath = path.resolve(process.cwd(), configPath);

    // Create .env file if it doesn't exist
    if (!fs.existsSync(this.configPath)) {
      logger.info("Creating new .env file from template");
      const templatePath = path.resolve(process.cwd(), ".env.example");
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, this.configPath);
      } else {
        // Create basic .env template
        const defaultEnv = [
          "# Minecraft Server Configuration",
          "MINECRAFT_HOST=localhost",
          "MINECRAFT_PORT=50000",
          "MINECRAFT_USERNAME=bot",
          "MINECRAFT_VERSION=1.21.5",
          "",
          "# Bot Settings",
          "BOT_PREFIX=.bot",
          "BOT_VIEW_DISTANCE=4",
          "BOT_CHAT_DISTANCE=16",
          "BOT_SAFE_MODE=true",
          "",
          "# LLM Settings",
          "OLLAMA_HOST=http://localhost:11434",
          "OLLAMA_MODEL=llama3.2:1b",
          "OLLAMA_TEMPERATURE=0.7",
          "OLLAMA_MAX_TOKENS=1000",
          "OLLAMA_TIMEOUT=60000",
          "",
          "# Version",
          `CONFIG_VERSION=${ConfigVersion.CURRENT}`,
        ].join("\n");
        fs.writeFileSync(this.configPath, defaultEnv);
      }
    }

    await this.loadConfig();
    this.startWatching();
    this.isInitialized = true;
  }

  public stop(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    this.isInitialized = false;
  }

  public getConfig(): Config {
    if (!this.isInitialized) {
      throw new Error("Config manager not initialized");
    }
    return this.config;
  }

  public subscribe(callback: ConfigChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  public async updateConfig(updates: Partial<Config>): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Config manager not initialized");
    }

    // Validate updates against schema
    const updatedConfig = { ...this.config, ...updates };
    const result = baseConfigSchema.safeParse(updatedConfig);

    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    // Update config file
    const envContent = Object.entries(updatedConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    await fs.promises.writeFile(this.configPath, envContent);

    // Update in-memory config
    this.config = result.data;

    // Notify subscribers
    await this.notifySubscribers();
  }

  private async loadConfig(): Promise<void> {
    try {
      // Load environment variables
      const envConfig = dotenv.config({ path: this.configPath });
      if (envConfig.error) {
        logger.error("Failed to load .env file", {
          error: envConfig.error.message,
          path: this.configPath,
        });
        throw envConfig.error;
      }

      // Convert environment variables to correct types
      const processedEnv = {
        ...process.env,
        MINECRAFT_PORT: process.env['MINECRAFT_PORT']
          ? parseInt(process.env['MINECRAFT_PORT'], 10)
          : undefined,
        BOT_VIEW_DISTANCE: process.env['BOT_VIEW_DISTANCE']
          ? parseInt(process.env['BOT_VIEW_DISTANCE'], 10)
          : undefined,
        BOT_CHAT_DISTANCE: process.env['BOT_CHAT_DISTANCE']
          ? parseInt(process.env['BOT_CHAT_DISTANCE'], 10)
          : undefined,
        OLLAMA_TEMPERATURE: process.env['OLLAMA_TEMPERATURE']
          ? parseFloat(process.env['OLLAMA_TEMPERATURE'])
          : undefined,
        OLLAMA_MAX_TOKENS: process.env['OLLAMA_MAX_TOKENS']
          ? parseInt(process.env['OLLAMA_MAX_TOKENS'], 10)
          : undefined,
        STORAGE_MAX_AGE: process.env['STORAGE_MAX_AGE']
          ? parseInt(process.env['STORAGE_MAX_AGE'], 10)
          : undefined,
        STORAGE_MAX_COMPLETED_AGE: process.env['STORAGE_MAX_COMPLETED_AGE']
          ? parseInt(process.env['STORAGE_MAX_COMPLETED_AGE'], 10)
          : undefined,
        STORAGE_CLEANUP_INTERVAL: process.env['STORAGE_CLEANUP_INTERVAL']
          ? parseInt(process.env['STORAGE_CLEANUP_INTERVAL'], 10)
          : undefined,
        STORAGE_MAX_HISTORY: process.env['STORAGE_MAX_HISTORY']
          ? parseInt(process.env['STORAGE_MAX_HISTORY'], 10)
          : undefined,
        LOG_MAX_SIZE: process.env['LOG_MAX_SIZE']
          ? parseInt(process.env['LOG_MAX_SIZE'], 10)
          : undefined,
        LOG_MAX_FILES: process.env['LOG_MAX_FILES']
          ? parseInt(process.env['LOG_MAX_FILES'], 10)
          : undefined,
        METRICS_PORT: process.env['METRICS_PORT']
          ? parseInt(process.env['METRICS_PORT'], 10)
          : undefined,
        BOT_SAFE_MODE: process.env['BOT_SAFE_MODE']
          ? process.env['BOT_SAFE_MODE'].toLowerCase() === "true"
          : undefined,
        FEATURE_AUTO_EAT: process.env['FEATURE_AUTO_EAT']
          ? process.env['FEATURE_AUTO_EAT'].toLowerCase() === "true"
          : undefined,
        FEATURE_AUTO_COLLECT: process.env['FEATURE_AUTO_COLLECT']
          ? process.env['FEATURE_AUTO_COLLECT'].toLowerCase() === "true"
          : undefined,
        FEATURE_PATHFINDING: process.env['FEATURE_PATHFINDING']
          ? process.env['FEATURE_PATHFINDING'].toLowerCase() === "true"
          : undefined,
        FEATURE_WORLD_TRACKING: process.env['FEATURE_WORLD_TRACKING']
          ? process.env['FEATURE_WORLD_TRACKING'].toLowerCase() === "true"
          : undefined,
        METRICS_ENABLED: process.env['METRICS_ENABLED']
          ? process.env['METRICS_ENABLED'].toLowerCase() === "true"
          : undefined,
      };

      // Parse and validate config
      const result = baseConfigSchema.safeParse(processedEnv);
      if (!result.success) {
        const errorDetails = result.error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        logger.error("Configuration validation failed", {
          errors: errorDetails,
          env: processedEnv,
        });
        throw new Error(
          `Invalid configuration: ${JSON.stringify(errorDetails, null, 2)}`
        );
      }

      this.config = result.data;
      logger.info("Configuration loaded successfully", {
        version: this.config.CONFIG_VERSION,
        host: this.config.MINECRAFT_HOST,
        port: this.config.MINECRAFT_PORT,
      });
    } catch (error) {
      logger.error("Failed to load configuration", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        path: this.configPath,
      });
      throw error;
    }
  }

  private startWatching(): void {
    this.watchInterval = setInterval(async () => {
      try {
        const stats = await fs.promises.stat(this.configPath);
        const mtime = stats.mtime.getTime();

        if (mtime > (this.config as any)._lastModified) {
          await this.loadConfig();
          await this.notifySubscribers();
        }
      } catch (error) {
        logger.error("Error watching config file", { error });
      }
    }, 5000); // Check every 5 seconds
  }

  private async notifySubscribers(): Promise<void> {
    const promises = Array.from(this.changeCallbacks).map((callback) =>
      Promise.resolve(callback(this.config)).catch((error) => {
        logger.error("Error in config change callback", { error });
      })
    );
    await Promise.all(promises);
  }

  public async migrateConfig(
    oldConfig: Record<string, string>
  ): Promise<Record<string, string>> {
    const currentVersion = oldConfig['CONFIG_VERSION'] || ConfigVersion.V1_0_0;
    const migratedConfig = { ...oldConfig };

    // Migration from V1_0_0 to V1_1_0
    if (currentVersion === ConfigVersion.V1_0_0) {
      // Add new feature flags
      migratedConfig['FEATURE_AUTO_EAT'] = "true";
      migratedConfig['FEATURE_AUTO_COLLECT'] = "true";
      migratedConfig['FEATURE_PATHFINDING'] = "true";
      migratedConfig['FEATURE_WORLD_TRACKING'] = "true";

      // Add metrics settings
      migratedConfig['METRICS_ENABLED'] = "true";
      migratedConfig['METRICS_PORT'] = "9090";
      migratedConfig['METRICS_PREFIX'] = "minecraft_bot_";

      // Update version
      migratedConfig['CONFIG_VERSION'] = ConfigVersion.V1_1_0;
    }

    return migratedConfig;
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();
