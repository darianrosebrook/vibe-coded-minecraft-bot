import { Bot as MineflayerBot, BotOptions, BotEvents } from 'mineflayer';
import { Vec3 } from 'vec3';
import { WorldTracker } from './worldTracking';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import mineflayer from 'mineflayer';
import { ToolManager } from '../bot/toolManager';
import * as toolPlugin from 'mineflayer-tool';
import * as collectBlockPlugin from 'mineflayer-collectblock';
import { TaskParser } from '../llm/parse'; 
import { OllamaClient } from '../utils/llmClient';
import { TaskParsingLogger } from '../llm/logging/logger';
import { ZodSchemaValidator } from '../utils/taskValidator';
import { ErrorHandler } from '../error/errorHandler';
import { Biome } from 'prismarine-biome';

export class MinecraftBot {
  private bot: MineflayerBot;
  private worldTracker: WorldTracker | null = null;
  private toolManager: ToolManager;
  private taskParser: TaskParser;
  private biomeData: any;

  constructor(options: {
    host: string;
    port: number;
    username: string;
    password?: string;
    version: string;
  }) { 
    // Validate version format (e.g., "1.20.1")
    if (!/^\d+\.\d+\.\d+$/.test(options.version)) {
      throw new Error(`Invalid Minecraft version format: ${options.version}. Expected format: X.Y.Z`);
    }
 

    try { 
      const botOptions = {
        host: options.host,
        port: options.port,
        username: options.username, 
        auth: 'offline' as const,
        checkTimeoutInterval: 60 * 1000,
        hideErrors: false,  
        version: options.version
      } satisfies BotOptions;
 
      this.bot = mineflayer.createBot(botOptions);
      toolPlugin.plugin(this.bot);
      collectBlockPlugin.plugin(this.bot);
      this.toolManager = new ToolManager(this, {
        repairThreshold: 20,
        preferredEnchantments: {
          pickaxe: ['efficiency', 'unbreaking', 'fortune'],
          axe: ['efficiency', 'unbreaking', 'fortune'],
          shovel: ['efficiency', 'unbreaking', 'fortune'],
          sword: ['sharpness', 'unbreaking', 'looting'],
          hoe: ['efficiency', 'unbreaking']
        },
        repairMaterials: {
          wooden: 'planks',
          stone: 'cobblestone',
          iron: 'iron_ingot',
          golden: 'gold_ingot',
          diamond: 'diamond',
          netherite: 'netherite_ingot'
        },
        repairQueue: {
          maxQueueSize: 10,
          processInterval: 1000,
          priorityWeights: {
            durability: 0.7,
            material: 0.3
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
        }
      });

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

      // Wait for spawn before initializing world tracker
      this.bot.once('spawn', () => {
        logger.info('Bot spawned in world');
        metrics.botUptime.set(0);
        this.biomeData = require('prismarine-biome')(this.bot.version);
        this.worldTracker = new WorldTracker(this);
        this.setupEventListeners();
      });

      this.taskParser = new TaskParser(
        new OllamaClient(),
        new TaskParsingLogger(),
        new ZodSchemaValidator(),
        new ErrorHandler(this)
      );
    } catch (error) {
      logger.error('Failed to create Minecraft bot', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        options: {
          host: options.host,
          port: options.port,
          username: options.username,
          version: options.version
        }
      });
      throw error;
    }
  }

  private setupEventListeners() {
    this.bot.on('spawn', () => {
      logger.info('Bot spawned in world');
      metrics.botUptime.set(0);
    });

    this.bot.on('death', () => {
      logger.warn('Bot died');
    });

    this.bot.on('kicked', (reason) => {
      logger.error('Bot was kicked', { reason });
    });

    this.bot.on('error', (err) => {
      logger.error('Bot error', { error: err });
    });
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
  public getWorldTracker(): WorldTracker | null {
    return this.worldTracker;
  }

  public async findResource(blockType: string): Promise<Vec3 | null> {
    return this.worldTracker?.findNearestResource(blockType) ?? null  ;
  }

  public getBiomeAt(position: Vec3): string | null {
    return this.worldTracker?.getBiomeAt(position) ?? null;
  }

  public getKnownBlocks(biome: string): string[] | null {
    return this.worldTracker?.getKnownBlocks(biome) ?? null;
  }

  public getMineflayerBot(): MineflayerBot {
    return this.bot;
  }

  public getToolManager(): ToolManager {
    return this.toolManager;
  }

  public chat(message: string): void { 
    this.bot.chat(message);
  }

  public async disconnect(): Promise<void> {
    await this.bot.quit();
  }

  public clearCommandCache(): void {
    this.taskParser.clearCache();
    logger.info('Command cache cleared');
  }
} 