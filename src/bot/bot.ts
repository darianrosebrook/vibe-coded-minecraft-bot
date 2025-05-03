import { Bot as MineflayerBot, BotOptions, BotEvents } from 'mineflayer';
import { ErrorHandler } from '../error/errorHandler';
import { metrics } from '../utils/observability/metrics';
import { OllamaClient } from '../utils/llmClient';
import { PerformanceTracker } from '../utils/observability/performance';
import { PerformanceEvent } from '../ml/performance/tracker';
import { TaskType } from '@/types/task';
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
import * as pathfinderPlugin from 'mineflayer-pathfinder';
import logger from '../utils/observability/logger';
import mineflayer from 'mineflayer';
import { MLManager } from '../ml/manager';
import { MLConfig } from '../ml/config';

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
  { apply: (bot) => pathfinderPlugin.pathfinder(bot) },
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
  private performanceTracker: PerformanceTracker;
  private currentCorrelationId: string | null = null;
  private mlManager: MLManager;
  private _activeTask: { name: string; [key: string]: any } | undefined;
  private _activeTaskProgress: number = 0;

  constructor(
    config: BotConfig,
    private readonly plugins: BotPlugin[] = defaultPlugins,
    private readonly botFactory: (opts: BotOptions) => MineflayerBot = mineflayer.createBot,
    private readonly llmClient: OllamaClient = new OllamaClient(),
    private readonly taskValidator: ZodSchemaValidator = new ZodSchemaValidator(),
    private readonly errorHandler: ErrorHandler = new ErrorHandler(this),
    mlConfig?: Partial<MLConfig>
  ) {
    this.config = BotConfigSchema.parse(config);
    this.biomeData = prismarineBiome;
    this.performanceTracker = new PerformanceTracker();
    this.mlManager = new MLManager(this, mlConfig, this.performanceTracker);
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize mineflayer bot
      this.performanceTracker.startTracking('bot_initialization');
      this.initializeBot();

      // Wait for spawn event before initializing other components
      await new Promise<void>((resolve) => {
        this.bot.once('spawn', () => {
          // Wait a short time for the bot to fully initialize
          setTimeout(() => {
            resolve();
          }, 1000);
        });
      });

      // Initialize managers
      this.performanceTracker.startTracking('managers_initialization');
      this.initializeManagers();
      this.performanceTracker.endTracking('managers_initialization');

      // Initialize ML components
      this.performanceTracker.startTracking('ml_initialization');
      await this.mlManager.initialize();
      this.performanceTracker.endTracking('ml_initialization');

      // Initialize parser
      this.performanceTracker.startTracking('parser_initialization');
      this.initializeParser();
      this.performanceTracker.endTracking('parser_initialization');

      this.performanceTracker.endTracking('bot_initialization');
      logger.info('Bot initialized successfully', {
        username: this.bot.username,
        version: this.config.version
      });
    } catch (error) {
      this.performanceTracker.endTracking('bot_initialization');
      logger.error('Failed to initialize Minecraft bot', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      throw error;
    }
  }

  private initializeBot(): void {
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

    // Setup basic error handling
    this.bot.on('error', (err) => {
      logger.error('Bot error', { error: err });
    });
  }

  private initializePlugins(): void {
    for (const plugin of this.plugins) {
      try {
        plugin.apply(this.bot);
      } catch (error) {
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

  private initializeManagers(): void {
    this.toolManager = new ToolManager(this, {
      repairThreshold: this.config.repairThreshold,
      preferredEnchantments: this.config.preferredEnchantments,
      repairMaterials: this.config.repairMaterials,
      repairQueue: this.config.repairQueue,
      toolSelection: this.config.toolSelection,
      crafting: this.config.crafting
    });

    this.worldTracker = new WorldTracker(this);
    this.worldTracker.initialize(this.bot);
  }

  private initializeParser(): void {
    this.taskParser = new TaskParser(
      this.llmClient,
      new TaskParsingLogger(),
      this.taskValidator,
      this.errorHandler
    );
  }

  private wireSpawnLogic(): void {
    this.bot.once('spawn', () => {
      logger.info('Bot spawned in world');
      metrics.botUptime.set(0);
      this.setupEventListeners();
    });
  }

  private setupEventListeners(): void {
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
          metrics.queueLatency.observe({ operation: 'process', status: 'success' }, Date.now() - startTime);
          resolve();
        } catch (error) {
          metrics.queueLatency.observe({ operation: 'process', status: 'error' }, Date.now() - startTime);
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
      errorType: metadata['errorType'],
      correlationId: metadata['correlationId'] || this.currentCorrelationId,
      metadata,
      timestamp: Date.now()
    });
  }
 

  public async findResource(blockType: string): Promise<Vec3 | null> {
    const startTime = Date.now();
    const result = await this.worldTracker.findResource(blockType);
    this.trackPerformance('scan', 'resource', Date.now() - startTime, true, { blockType });
    return result;
  }

  public getBiomeAt(position: Vec3): string | null {
    return this.worldTracker.getBiomeAt(position);
  }

  public getKnownBlocks(biome: string): string[] {
    return this.worldTracker.getKnownBlocks(biome);
  }

  public getMineflayerBot(): MineflayerBot {
    return this.bot;
  }

  public getToolManager(): ToolManager {
    return this.toolManager;
  }

  public async executeCommand(command: string): Promise<TaskType> {
    const startTime = Date.now();
    let retryCount = 0;
    let delay = this.config.commandQueue.retryConfig.initialDelay;
    const { maxRetries, maxDelay, backoffFactor } = this.config.commandQueue.retryConfig;
    const commandType = command.split(' ')[0] || 'unknown';
    const correlationId = uuidv4();

    while (retryCount <= maxRetries) {
      try {
        const result = await this.taskParser.parse(command);
        metrics.commandLatency.observe({ command_type: commandType || 'unknown', status: 'success' }, Date.now() - startTime);
        this.trackPerformance('command', commandType, Date.now() - startTime, true, {
          correlationId,
          retryCount
        });
        return result.type as TaskType;
      } catch (error) {
        if (retryCount < maxRetries) {
          metrics.commandLatency.observe({ command_type: commandType, status: 'retry' }, Date.now() - startTime);
          this.trackPerformance('command', commandType, Date.now() - startTime, false, {
            correlationId,
            retryCount,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
          delay = Math.min(delay * backoffFactor, maxDelay);
          retryCount++;
        } else {
          metrics.commandLatency.observe({ command_type: commandType, status: 'error' }, Date.now() - startTime);
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
      this.bot?.off(event, listener);
    }
    this.eventListeners.clear();

    // Shutdown ML components
    await this.mlManager.shutdown();

    if (this.bot) {
      await this.bot.quit();
    }
  }

  private resetEventLoop(): void {
    // Clear existing event listeners
    for (const [event, listener] of this.eventListeners) {
      this.bot.off(event, listener);
    }
    this.eventListeners.clear();

    // Clear world tracker caches
    this.worldTracker.clearCaches();

    // Reset command queue
    this.commandQueue = [];
    this.isProcessingQueue = false;

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
      this.initialize();
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

  public getMLManager(): MLManager {
    return this.mlManager;
  }

  // Task tracking methods for ML data collection
  public setActiveTask(taskName: string, taskData: any = {}): void {
    this._activeTask = {
      name: taskName,
      ...taskData
    };
    this._activeTaskProgress = 0;
    logger.info(`Started task: ${taskName}`);
  }

  public updateTaskProgress(progress: number): void {
    this._activeTaskProgress = progress;
  }

  public clearActiveTask(): void {
    const taskName = this._activeTask?.name || 'Unknown';
    this._activeTask = undefined;
    this._activeTaskProgress = 0;
    logger.info(`Completed task: ${taskName}`);
  }

  public getActiveTask(): { name: string; progress: number } | null {
    if (!this._activeTask) {
      return null;
    }
    
    return {
      name: this._activeTask.name,
      progress: this._activeTaskProgress || 0
    };
  }
} 