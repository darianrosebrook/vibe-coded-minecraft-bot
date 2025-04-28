import { Bot as MineflayerBot, BotOptions, BotEvents } from 'mineflayer';
import { Counter, Histogram } from 'prom-client';
import { ErrorHandler } from '../error/errorHandler';
import { LRUCache } from 'lru-cache';
import { metrics } from '../utils/observability/metrics';
import { OllamaClient } from '../utils/llmClient';
import { PerformanceTracker, PerformanceEvent } from '../ml/performance/tracker';
import { Task } from '../types/task';
import { TaskParser } from '../llm/parse';
import { TaskParsingLogger } from '../llm/logging/logger';
import { ToolManager } from '../bot/toolManager';
import { v4 as uuidv4 } from 'uuid';
import { Vec3 } from 'vec3';
import { WorldTracker } from './worldTracking';
import { z } from 'zod';
import { ZodSchemaValidator } from '../utils/taskValidator';
import * as collectBlockPlugin from 'mineflayer-collectblock';
import * as prismarineBiome from 'prismarine-biome';
import * as toolPlugin from 'mineflayer-tool';
import logger from '../utils/observability/logger';
import mineflayer from 'mineflayer';

// Extend metrics with new counters and histograms
const pluginInitFailures = new Counter({
  name: 'bot_plugin_init_failures',
  help: 'Number of plugin initialization failures',
  labelNames: ['plugin_name'] as const,
});

const commandExecutions = new Counter({
  name: 'bot_command_executions',
  help: 'Number of command executions',
  labelNames: ['command_type', 'status'] as const,
});

const commandRetries = new Counter({
  name: 'bot_command_retries',
  help: 'Number of command retries',
  labelNames: ['command_type'] as const,
});

const commandLatency = new Histogram({
  name: 'bot_command_latency_ms',
  help: 'LLM parsing latency in ms',
  labelNames: ['command_type', 'status'] as const,
  buckets: [50, 100, 200, 500, 1000, 2000]
});

const cacheLatency = new Histogram({
  name: 'bot_cache_latency_ms',
  help: 'Cache operation latency in ms',
  labelNames: ['operation', 'status'] as const,
  buckets: [1, 5, 10, 25, 50, 100]
});

const queueLatency = new Histogram({
  name: 'bot_queue_latency_ms',
  help: 'Command queue processing latency in ms',
  labelNames: ['operation', 'status'] as const,
  buckets: [10, 50, 100, 250, 500, 1000]
});

// Default configuration values
const DEFAULT_CONFIG = {
  checkTimeoutInterval: 60_000,
  hideErrors: false,
  repairThreshold: 20,
  repairQueue: {
    maxQueueSize: 10,
    processInterval: 1000,
    priorityWeights: {
      durability: 0.7,
      material: 0.3
    }
  },
  commandQueue: {
    maxSize: 100,
    processInterval: 100,
    retryConfig: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2
    }
  },
  toolSelection: {
    efficiencyWeight: 0.2,
    durabilityWeight: 0.3,
    materialWeight: 0.3,
    enchantmentWeight: 0.2
  },
  crafting: {
    allowTierDowngrade: true,
    maxDowngradeAttempts: 2,
    preferExistingTools: true
  },
  preferredEnchantments: {
    pickaxe: ['efficiency', 'unbreaking', 'fortune'],
    axe: ['efficiency', 'unbreaking', 'fortune'],
    shovel: ['efficiency', 'unbreaking', 'fortune'],
    sword: ['sharpness', 'unbreaking', 'looting'],
    hoe: ['efficiency', 'unbreaking']
  } as Record<string, string[]>,
  repairMaterials: {
    wooden: 'planks',
    stone: 'cobblestone',
    iron: 'iron_ingot',
    golden: 'gold_ingot',
    diamond: 'diamond',
    netherite: 'netherite_ingot'
  } as Record<string, string>,
  cache: {
    ttl: 60_000, // 1 minute
    maxSize: 1000,
    scanDebounceMs: 1000,
    cleanupInterval: 5 * 60_000 // 5 minutes
  }
} as const;

// Extended configuration schema
const BotConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  checkTimeoutInterval: z.number().int().positive().default(DEFAULT_CONFIG.checkTimeoutInterval),
  hideErrors: z.boolean().default(DEFAULT_CONFIG.hideErrors),
  repairThreshold: z.number().int().positive().default(DEFAULT_CONFIG.repairThreshold),
  repairQueue: z.object({
    maxQueueSize: z.number().int().positive().default(DEFAULT_CONFIG.repairQueue.maxQueueSize),
    processInterval: z.number().int().positive().default(DEFAULT_CONFIG.repairQueue.processInterval),
    priorityWeights: z.object({
      durability: z.number().min(0).max(1).default(DEFAULT_CONFIG.repairQueue.priorityWeights.durability),
      material: z.number().min(0).max(1).default(DEFAULT_CONFIG.repairQueue.priorityWeights.material)
    }).default(DEFAULT_CONFIG.repairQueue.priorityWeights)
  }).default(DEFAULT_CONFIG.repairQueue),
  commandQueue: z.object({
    maxSize: z.number().int().positive().default(DEFAULT_CONFIG.commandQueue.maxSize),
    processInterval: z.number().int().positive().default(DEFAULT_CONFIG.commandQueue.processInterval),
    retryConfig: z.object({
      maxRetries: z.number().int().positive().default(DEFAULT_CONFIG.commandQueue.retryConfig.maxRetries),
      initialDelay: z.number().int().positive().default(DEFAULT_CONFIG.commandQueue.retryConfig.initialDelay),
      maxDelay: z.number().int().positive().default(DEFAULT_CONFIG.commandQueue.retryConfig.maxDelay),
      backoffFactor: z.number().positive().default(DEFAULT_CONFIG.commandQueue.retryConfig.backoffFactor)
    }).default(DEFAULT_CONFIG.commandQueue.retryConfig)
  }).default(DEFAULT_CONFIG.commandQueue),
  toolSelection: z.object({
    efficiencyWeight: z.number().min(0).max(1).default(DEFAULT_CONFIG.toolSelection.efficiencyWeight),
    durabilityWeight: z.number().min(0).max(1).default(DEFAULT_CONFIG.toolSelection.durabilityWeight),
    materialWeight: z.number().min(0).max(1).default(DEFAULT_CONFIG.toolSelection.materialWeight),
    enchantmentWeight: z.number().min(0).max(1).default(DEFAULT_CONFIG.toolSelection.enchantmentWeight)
  }).default(DEFAULT_CONFIG.toolSelection),
  crafting: z.object({
    allowTierDowngrade: z.boolean().default(DEFAULT_CONFIG.crafting.allowTierDowngrade),
    maxDowngradeAttempts: z.number().int().positive().default(DEFAULT_CONFIG.crafting.maxDowngradeAttempts),
    preferExistingTools: z.boolean().default(DEFAULT_CONFIG.crafting.preferExistingTools)
  }).default(DEFAULT_CONFIG.crafting),
  preferredEnchantments: z.record(z.array(z.string())).default(DEFAULT_CONFIG.preferredEnchantments),
  repairMaterials: z.record(z.string()).default(DEFAULT_CONFIG.repairMaterials),
  cache: z.object({
    ttl: z.number().int().positive().default(DEFAULT_CONFIG.cache.ttl),
    maxSize: z.number().int().positive().default(DEFAULT_CONFIG.cache.maxSize),
    scanDebounceMs: z.number().int().positive().default(DEFAULT_CONFIG.cache.scanDebounceMs),
    cleanupInterval: z.number().int().positive().default(DEFAULT_CONFIG.cache.cleanupInterval)
  }).default(DEFAULT_CONFIG.cache)
});

export type BotConfig = z.infer<typeof BotConfigSchema>;

// Plugin interface for dependency injection
export interface BotPlugin {
  apply(bot: MineflayerBot): void;
}

// Default plugins
const defaultPlugins: BotPlugin[] = [
  { apply: (bot) => toolPlugin.plugin(bot) },
  { apply: (bot) => collectBlockPlugin.plugin(bot) },
];

export class MinecraftBot {
  private bot!: MineflayerBot;
  private worldTracker!: WorldTracker;
  private toolManager!: ToolManager;
  private taskParser!: TaskParser;
  private biomeData: typeof prismarineBiome;
  private config: BotConfig;
  private eventListeners: Map<keyof BotEvents, BotEvents[keyof BotEvents]> = new Map();
  private commandQueue: Array<{ command: string; resolve: (value: void) => void; reject: (error: Error) => void }> = [];
  private isProcessingQueue: boolean = false;
  private resourceCache: LRUCache<string, Vec3>;
  private biomeCache: LRUCache<string, string>;
  private blockCache: LRUCache<string, string[]>;
  private scanDebounces: Map<string, NodeJS.Timeout> = new Map();
  private performanceTracker: PerformanceTracker;
  private currentCorrelationId: string | null = null;

  constructor(
    config: BotConfig,
    private readonly plugins: BotPlugin[] = defaultPlugins,
    private readonly botFactory: (opts: BotOptions) => MineflayerBot = mineflayer.createBot,
    private readonly llmClient: OllamaClient = new OllamaClient(),
    private readonly taskValidator: ZodSchemaValidator = new ZodSchemaValidator(),
    private readonly errorHandler: ErrorHandler = new ErrorHandler(this)
  ) {
    // Validate and store config
    this.config = BotConfigSchema.parse(config);
    this.biomeData = prismarineBiome;
    this.performanceTracker = new PerformanceTracker();

    // Initialize typed LRU caches
    const cacheOptions = {
      max: this.config.cache.maxSize,
      ttl: this.config.cache.ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: true
    };
    this.resourceCache = new LRUCache(cacheOptions);
    this.biomeCache = new LRUCache(cacheOptions);
    this.blockCache = new LRUCache(cacheOptions);

    try {
      this.initializeBot();
    } catch (error) {
      logger.error('Failed to create Minecraft bot', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        config: {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          version: this.config.version
        }
      });
      throw error;
    }
  }

  private initializeBot() {
    const botOptions: BotOptions = {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      auth: 'offline' as const,
      checkTimeoutInterval: this.config.checkTimeoutInterval,
      hideErrors: this.config.hideErrors,
      version: this.config.version
    };

    this.bot = this.botFactory(botOptions);
    this.initializePlugins();
    this.initializeToolManager();
    this.initializeParser();
    this.wireSpawnLogic();
  }

  private initializePlugins() {
    for (const plugin of this.plugins) {
      try {
        plugin.apply(this.bot);
      } catch (error) {
        pluginInitFailures.inc({ plugin_name: plugin.constructor.name });
        logger.error('Failed to initialize plugin', {
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : error
        });
        throw error;
      }
    }
  }

  private initializeToolManager() {
    this.toolManager = new ToolManager(this, {
      repairThreshold: this.config.repairThreshold,
      preferredEnchantments: this.config.preferredEnchantments,
      repairMaterials: this.config.repairMaterials,
      repairQueue: this.config.repairQueue,
      toolSelection: this.config.toolSelection,
      crafting: this.config.crafting
    });
  }

  private initializeParser() {
    this.taskParser = new TaskParser(
      this.llmClient,
      new TaskParsingLogger(),
      this.taskValidator,
      this.errorHandler
    );
  }

  private wireSpawnLogic() {
    // Add error handler before any other events
    this.bot.once('error', (err) => {
      logger.error('Initial bot connection error', {
        error: err instanceof Error ? {
          message: err.message,
          stack: err.stack,
          name: err.name
        } : err
      });
    });

    // Wait for spawn before initializing world tracker and event listeners
    this.bot.once('spawn', () => {
      logger.info('Bot spawned in world');
      metrics.botUptime.set(0);
      this.setupEventListeners();
    });
  }

  private setupEventListeners() {
    // Initialize world tracker after spawn
    this.worldTracker = new WorldTracker(this);

    const deathHandler = () => {
      logger.warn('Bot died');
    };
    this.bot.on('death', deathHandler);
    this.eventListeners.set('death', deathHandler);

    const kickedHandler = (reason: string) => {
      logger.error('Bot was kicked', { reason });
    };
    this.bot.on('kicked', kickedHandler);
    this.eventListeners.set('kicked', kickedHandler);

    const errorHandler = (err: Error) => {
      logger.error('Bot error', { error: err });
    };
    this.bot.on('error', errorHandler);
    this.eventListeners.set('error', errorHandler);
  }

  // Event handling methods
  public on<K extends keyof BotEvents>(event: K, listener: BotEvents[K]): void {
    this.bot.on(event, listener);
  }

  public once<K extends keyof BotEvents>(event: K, listener: BotEvents[K]): void {
    this.bot.once(event, listener);
  }

  public off<K extends keyof BotEvents>(event: K, listener: BotEvents[K]): void {
    this.bot.off(event, listener);
  }

  // Public API
  public getWorldTracker(): WorldTracker {
    return this.worldTracker;
  }

  private async processCommandQueue(): Promise<void> {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const startTime = Date.now();
    const correlationId = this.currentCorrelationId || uuidv4();
    this.currentCorrelationId = correlationId;

    try {
      while (this.commandQueue.length > 0) {
        const { command, resolve, reject } = this.commandQueue.shift()!;
        try {
          await this.executeCommand(command);
          queueLatency.observe({ operation: 'process', status: 'success' }, Date.now() - startTime);
          resolve();
        } catch (error) {
          queueLatency.observe({ operation: 'process', status: 'error' }, Date.now() - startTime);
          reject(error as Error);
        }

        // Update queue length metric after each dequeue
        metrics.queueLength.set(this.commandQueue.length);

        // Respect process interval if configured
        if (this.config.commandQueue.processInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.commandQueue.processInterval));
        }
      }
    } finally {
      this.isProcessingQueue = false;
      this.trackPerformance('queue', 'process', Date.now() - startTime, true, {
        queueLength: this.commandQueue.length,
        correlationId
      });
    }
  }

  public async queueCommand(command: string): Promise<void> {
    if (this.commandQueue.length >= this.config.commandQueue.maxSize) {
      const error = new Error('Command queue is full');
      this.trackPerformance('queue', 'reject', 0, false, {
        errorType: 'queue_full',
        correlationId: this.currentCorrelationId
      });
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      metrics.queueLength.set(this.commandQueue.length);
      this.processCommandQueue();
    });
  }

  private trackPerformance(
    type: PerformanceEvent['type'],
    name: string,
    duration: number,
    success: boolean,
    metadata: Record<string, any> = {}
  ): void {
    this.performanceTracker.trackEvent({
      type,
      name,
      duration,
      success,
      errorType: metadata.errorType,
      correlationId: metadata.correlationId || this.currentCorrelationId,
      metadata,
      timestamp: Date.now()
    });
  }

  private getCached<T extends {}>(key: string, cache: LRUCache<string, T>): T | null {
    const startTime = Date.now();
    const cached = cache.get(key);
    if (!cached) {
      cacheLatency.observe({ operation: 'get', status: 'miss' }, Date.now() - startTime);
      this.trackPerformance('cache', 'miss', Date.now() - startTime, true, {
        key,
        correlationId: this.currentCorrelationId
      });
      return null;
    }

    cacheLatency.observe({ operation: 'get', status: 'hit' }, Date.now() - startTime);
    this.trackPerformance('cache', 'hit', Date.now() - startTime, true, {
      key,
      correlationId: this.currentCorrelationId
    });
    return cached;
  }

  private setCached<T extends {}>(key: string, value: T, cache: LRUCache<string, T>): void {
    const startTime = Date.now();
    cache.set(key, value);
    metrics.cacheSize.set(cache.size);
    cacheLatency.observe({ operation: 'set', status: 'success' }, Date.now() - startTime);
    this.trackPerformance('cache', 'set', Date.now() - startTime, true, {
      key,
      correlationId: this.currentCorrelationId
    });
  }

  public async findResource(blockType: string): Promise<Vec3 | null> {
    const startTime = Date.now();
    const cacheKey = `resource:${blockType}`;
    const cached = this.getCached(cacheKey, this.resourceCache);
    if (cached) {
      this.trackPerformance('scan', 'cache_hit', Date.now() - startTime, true, { blockType });
      return cached;
    }

    const key = `scan:${blockType}`;
    if (!this.scanDebounces.has(key)) {
      // No debounce entry → go straight
      const result = await this.worldTracker.findNearestResource(blockType);
      if (result) {
        this.setCached(cacheKey, result, this.resourceCache);
      }
      this.trackPerformance('scan', 'immediate', Date.now() - startTime, true, { blockType });
      return result;
    }

    // Otherwise debounce as before
    clearTimeout(this.scanDebounces.get(key)!);
    return new Promise<Vec3 | null>(resolve => {
      this.scanDebounces.set(key, setTimeout(async () => {
        this.scanDebounces.delete(key);
        const result = await this.worldTracker.findNearestResource(blockType);
        if (result) {
          this.setCached(cacheKey, result, this.resourceCache);
        }
        this.trackPerformance('scan', 'debounced', Date.now() - startTime, true, { blockType });
        resolve(result);
      }, this.config.cache.scanDebounceMs));
    });
  }

  public getBiomeAt(position: Vec3): string | null {
    const cacheKey = `biome:${position.x},${position.y},${position.z}`;
    const cached = this.getCached(cacheKey, this.biomeCache);
    if (cached) return cached;

    const result = this.worldTracker.getBiomeAt(position);
    if (result) {
      this.setCached(cacheKey, result, this.biomeCache);
    }
    return result;
  }

  public getKnownBlocks(biome: string): string[] | null {
    const cacheKey = `blocks:${biome}`;
    const cached = this.getCached(cacheKey, this.blockCache);
    if (cached) return cached;

    const result = this.worldTracker.getKnownBlocks(biome);
    if (result) {
      this.setCached(cacheKey, result, this.blockCache);
    }
    return result;
  }

  public getMineflayerBot(): MineflayerBot {
    return this.bot;
  }

  public getToolManager(): ToolManager {
    return this.toolManager;
  }

  public async executeCommand(command: string): Promise<Task> {
    const startTime = Date.now();
    let retryCount = 0;
    let delay = this.config.commandQueue.retryConfig.initialDelay;
    const { maxRetries, maxDelay, backoffFactor } = this.config.commandQueue.retryConfig;
    const commandType = command.split(' ')[0];
    const correlationId = uuidv4();

    while (retryCount <= maxRetries) {
      try {
        const result = await this.taskParser.parse(command);
        commandLatency.observe({ command_type: commandType, status: 'success' }, Date.now() - startTime);
        this.trackPerformance('command', commandType, Date.now() - startTime, true, {
          correlationId,
          retryCount
        });
        return result;
      } catch (error) {
        if (retryCount < maxRetries) {
          commandLatency.observe({ command_type: commandType, status: 'retry' }, Date.now() - startTime);
          this.trackPerformance('command', commandType, Date.now() - startTime, false, {
            correlationId,
            retryCount,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
          delay = Math.min(delay * backoffFactor, maxDelay);
          retryCount++;
        } else {
          commandLatency.observe({ command_type: commandType, status: 'error' }, Date.now() - startTime);
          this.trackPerformance('command', commandType, Date.now() - startTime, false, {
            correlationId,
            retryCount,
            error: error instanceof Error ? error.message : 'Unknown error',
            final: true
          });
          throw error;
        }
      }
    }
    throw new Error('Command execution failed after all retries');
  }

  public chat(message: string): void {
    try {
      this.bot.chat(message);
    } catch (error) {
      logger.error('Failed to send chat message', {
        message,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    // Remove all event listeners
    for (const [event, listener] of this.eventListeners) {
      this.bot.off(event, listener);
    }
    this.eventListeners.clear();

    await this.bot.quit();
  }

  private resetEventLoop(): void {
    // Clear existing event listeners
    for (const [event, listener] of this.eventListeners) {
      this.bot.off(event, listener);
    }
    this.eventListeners.clear();

    // Clear any pending timeouts
    for (const timeout of this.scanDebounces.values()) {
      clearTimeout(timeout);
    }
    this.scanDebounces.clear();

    // Reset command queue
    this.commandQueue = [];
    this.isProcessingQueue = false;

    // Reset caches
    this.resourceCache.clear();
    this.biomeCache.clear();
    this.blockCache.clear();

    // Reset performance tracker
    this.performanceTracker = new PerformanceTracker();

    // Reset correlation ID
    this.currentCorrelationId = null;

    // Re-wire spawn logic
    this.wireSpawnLogic();
  }

  public async reconnect(): Promise<void> {
    try {
      await this.disconnect();
      this.initializeBot();
      this.resetEventLoop();
      logger.info('Bot reconnected successfully');
    } catch (error) {
      logger.error('Failed to reconnect bot', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      throw error;
    }
  }

  public clearCommandCache(): void {
    this.taskParser.clearCache();
    logger.info('Command cache cleared');
  }

  public getBiomeData(biomeId: number): prismarineBiome.Biome {
    return new this.biomeData.Biome(biomeId);
  }

  public updateConfig(newConfig: Partial<BotConfig>): void {
    try {
      // Validate the new config against the schema
      const updatedConfig = BotConfigSchema.parse({
        ...this.config,
        ...newConfig
      });

      // Update the config
      this.config = updatedConfig;

      // Reconfigure the tool manager with new settings
      this.toolManager.updateConfig({
        repairThreshold: this.config.repairThreshold,
        preferredEnchantments: this.config.preferredEnchantments,
        repairMaterials: this.config.repairMaterials,
        repairQueue: this.config.repairQueue,
        toolSelection: this.config.toolSelection,
        crafting: this.config.crafting
      });

      logger.info('Bot configuration updated successfully');
    } catch (error) {
      logger.error('Failed to update bot configuration', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      throw error;
    }
  }

  public getPerformanceMetrics() {
    return this.performanceTracker.getMetrics();
  }

  public getPerformanceDataForML() {
    return this.performanceTracker.getPerformanceDataForML();
  }
} 