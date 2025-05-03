import { Bot as MineflayerBot, BotOptions } from 'mineflayer';
import { BotConfig, BotConfigSchema } from '@/types/bot';
import { MinecraftBot, BotPlugin } from './bot'; 
import { OllamaClient } from '../utils/llmClient';
import { ZodSchemaValidator } from '../utils/taskValidator';
// import { ErrorHandler } from '../error/errorHandler';
import { defaultPlugins } from '@/bot/plugins';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import mineflayer from 'mineflayer';

export class BotFactory {
  constructor(
    private readonly plugins: BotPlugin[] = defaultPlugins,
    private readonly botFactory: (opts: BotOptions) => MineflayerBot = mineflayer.createBot,
    private readonly llmClient: OllamaClient = new OllamaClient(),
    private readonly taskValidator: ZodSchemaValidator = new ZodSchemaValidator()
  ) {
    this.botFactory = (opts: BotOptions) => {
      const bot = mineflayer.createBot(opts);
      return bot;
    }
  }

  public async createBot(config: BotConfig): Promise<MinecraftBot> {
    try {
      // Validate config
      const validatedConfig = BotConfigSchema.parse(config);

      // Create bot instance
      const bot = new MinecraftBot(
        {
          ...validatedConfig,
          hideErrors: false,
          checkTimeoutInterval: 60000,
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
          preferredEnchantments: {},
          repairMaterials: {},
          cache: {
            ttl: 60000,
            maxSize: 1000,
            scanDebounceMs: 1000,
            cleanupInterval: 300000
          }
        },
        this.plugins,
        this.botFactory,
        this.llmClient,
        this.taskValidator
      );
 

      // Initialize bot
      await this.initializeBot(bot);

      // Track successful initialization
      metrics.botInitializations.inc();
      logger.info('Bot initialized successfully');

      return bot;
    } catch (error) {
      metrics.botInitializationFailures.inc();
      logger.error('Failed to initialize bot', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      throw error;
    }
  }

  private async initializeBot(bot: MinecraftBot): Promise<void> {
    try {
      // Initialize core components
      await bot.initialize();

      // Setup event listeners
      this.setupEventListeners(bot);

      // Initialize managers
      await this.initializeManagers(bot);

      // Start monitoring
      this.startMonitoring(bot);
    } catch (error) {
      logger.error('Error during bot initialization', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      throw error;
    }
  }

  private setupEventListeners(bot: MinecraftBot): void {
    const mineflayerBot = bot.getMineflayerBot();

    // Error handling
    mineflayerBot.on('error', (err) => {
      logger.error('Bot error', { error: err });
      metrics.botErrors.inc();
    });

    // Connection events
    mineflayerBot.on('kicked', (reason) => {
      logger.warn('Bot was kicked', { reason });
      metrics.botKicks.inc();
    });

    mineflayerBot.on('end', () => {
      logger.info('Bot connection ended');
      metrics.botDisconnections.inc();
    });

    // Spawn events
    mineflayerBot.on('spawn', () => {
      logger.info('Bot spawned in world');
      metrics.botSpawns.inc();
    });
  }

  private async initializeManagers(bot: MinecraftBot): Promise<void> {
    bot
    // Initialize world tracker
    // const worldTracker = bot.getWorldTracker();

    // Initialize tool manager
    // const toolManager = bot.getToolManager();
  }

  private startMonitoring(bot: MinecraftBot): void {
    // Start performance monitoring
    setInterval(() => {
      const metrics = bot.getPerformanceMetrics();
      logger.info('Bot performance metrics', { metrics });
    }, 60000); // Log every minute
  }
} 