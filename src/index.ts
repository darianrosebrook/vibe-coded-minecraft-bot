import logger from './utils/observability/logger'; 
import { MinecraftBot } from "./bot/bot";
import { MiningTask } from "./tasks/mining";
import { FarmingTask } from "./tasks/farming";
import { NavTask } from "./tasks/nav";
import { InventoryTask } from "./tasks/inventory";
import { CommandHandler } from "./commands";
import { WorldTracker } from "./bot/worldTracking";
import * as fs from "fs";
import * as path from "path";
import { QueryTask } from "./tasks/query";
import { RedstoneTask } from "./tasks/redstone"; 
import { Vec3 } from "vec3";
import { configManager } from "./config/configManager";
import { Config } from "./config/config";
import { initializeParser } from "./llm/parse";
import { initializeWebServer, shutdownWebServer } from "./web/server";
import * as http from 'http';

// Ensure buildLogs directory exists
const buildLogsDir = path.join(process.cwd(), "buildLogs");
if (!fs.existsSync(buildLogsDir)) {
  fs.mkdirSync(buildLogsDir);
}

// Create a write stream for build logs
const buildLogStream = fs.createWriteStream(path.join(buildLogsDir, "latest"), {
  flags: "w",
});

// Override console.log to write to both console and build log file
const originalConsoleLog = console.log;
console.log = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
    .join(" ");
  buildLogStream.write(`[${timestamp}] ${message}\n`);
  originalConsoleLog(...args);
};

// Override console.error to write to both console and build log file
const originalConsoleError = console.error;
console.error = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
    .join(" ");
  buildLogStream.write(`[${timestamp}] ERROR: ${message}\n`);
  originalConsoleError(...args);
};

// Initialize the bot with current configuration
let bot: MinecraftBot | null = null;
let commandHandler: CommandHandler | null = null;
let worldTracker: WorldTracker | null = null;
let webServer: http.Server | null = null;

// Cleanup function to handle graceful shutdown
async function cleanup() {
  logger.info('Starting cleanup...');
  
  if (bot) {
    logger.info('Shutting down bot...');
    await bot.disconnect();
    bot = null;
  }

  if (webServer) {
    logger.info('Shutting down web server...');
    await shutdownWebServer(webServer);
    webServer = null;
  }

  if (commandHandler) {
    logger.info('Shutting down command handler...');
    commandHandler = null;
  }

  if (worldTracker) {
    logger.info('Shutting down world tracker...');
    worldTracker = null;
  }

  logger.info('Cleanup completed');
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await cleanup();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception', { error });
  await cleanup();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise });
  await cleanup();
  process.exit(1);
});

async function initializeBot(): Promise<void> {
  let config: Config | null = null;
  try {
    logger.info('Starting bot initialization...');
    
    // Initialize config manager first
    logger.info('Initializing config manager...');
    await configManager.initialize();
    config = configManager.getConfig();
    
    if (!config) {
      throw new Error('Failed to load configuration');
    }
    logger.info('Config loaded successfully');

    // Create new bot instance with current config
    logger.info('Creating new bot instance...');
    bot = new MinecraftBot({
      host: config.MINECRAFT_HOST,
      port: config.MINECRAFT_PORT,
      username: config.MINECRAFT_USERNAME,
      password: config.MINECRAFT_PASSWORD,
      version: config.MINECRAFT_VERSION,
      checkTimeoutInterval: 60000,
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
      },
      repairMaterials: {
        wooden: 'planks',
        stone: 'cobblestone',
        iron: 'iron_ingot',
        golden: 'gold_ingot',
        diamond: 'diamond',
        netherite: 'netherite_ingot'
      },
      cache: {
        ttl: 60000,
        maxSize: 1000,
        scanDebounceMs: 1000,
        cleanupInterval: 300000
      }
    });

    // Initialize the bot first
    logger.info('Initializing bot...');
    await bot.initialize();
    logger.info('Bot initialized successfully');

    // Initialize web server
    logger.info('Initializing web server...');
    webServer = await initializeWebServer(bot);
    logger.info('Web server initialized successfully');

    // Initialize world tracker
    logger.info('Initializing world tracker...');
    worldTracker = new WorldTracker(bot);
    logger.info('World tracker initialized');

    // Initialize parser
    logger.info('Initializing parser...');
    initializeParser(bot);
    logger.info('Parser initialized');

    // Initialize command handler
    logger.info('Initializing command handler...');
    commandHandler = new CommandHandler(bot);
    logger.info('Command handler initialized');

    // Create and initialize tasks
    logger.info('Initializing tasks...');
    const miningTask = new MiningTask(bot, commandHandler, {
      targetBlock: "stone",
      quantity: 64,
      radius: 32,
      usePathfinding: true,
    }, bot.getMLManager().getDataCollector());
    await miningTask.initialize();

    const farmingTask = new FarmingTask(bot, commandHandler, {
      cropType: "wheat",
      action: "harvest",
      quantity: 64,
      radius: 32,
      checkInterval: 5000,
      requiresWater: true,
      minWaterBlocks: 4,
      usePathfinding: true,
      area: {
        start: new Vec3(0, 64, 0),
        end: new Vec3(32, 64, 32)
      },
      dataCollector: bot.getMLManager().getDataCollector()
    });
    await farmingTask.initialize();

    const navTask = new NavTask(bot, commandHandler, {
      location: new Vec3(100, 64, -200),
      usePathfinding: true,
      maxDistance: 32,
      dataCollector: bot.getMLManager().getDataCollector()
    });
    await navTask.initialize();

    const inventoryTask = new InventoryTask(bot, commandHandler, {
      operation: "sort",
      dataCollector: bot.getMLManager().getDataCollector()
    });
    await inventoryTask.initialize();

    const queryTask = new QueryTask(bot, commandHandler, {
      queryType: "block",
      dataCollector: bot.getMLManager().getDataCollector()
    });
    await queryTask.initialize();

    const redstoneTask = new RedstoneTask(bot, commandHandler, {
      circuitType: "basic",
      radius: 5,
      dataCollector: bot.getMLManager().getDataCollector()
    });
    await redstoneTask.initialize();

    // Register tasks
    commandHandler.registerTask("mining", miningTask);
    commandHandler.registerTask("farming", farmingTask);
    commandHandler.registerTask("navigation", navTask);
    commandHandler.registerTask("inventory", inventoryTask);
    commandHandler.registerTask("query", queryTask);
    commandHandler.registerTask("redstone", redstoneTask);

    // Handle chat commands
    const mineflayerBot = bot.getMineflayerBot();
    mineflayerBot.on("chat", async (username: string, message: string) => {
      // Only log messages from other players, not the bot's own messages
      if (username !== mineflayerBot.username) {
        logger.info("Player message", {
          username,
          content: message,
        });
      }
      if (commandHandler) {
        await commandHandler.handleCommand(username, message);
      }
    });

    // Log bot's chat messages
    mineflayerBot.on("messagestr", (message: string) => {
      // Extract just the message content without the username prefix
      const content = message.replace(/^<[^>]+>\s*/, "");
      logger.info("Bot response", {
        content,
      });
    });

    logger.info("Bot initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize bot", {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    await cleanup();
    throw error;
  }
}

// Initialize bot with current configuration
initializeBot();

// Subscribe to configuration changes
const unsubscribe = configManager.subscribe(async () => {
  logger.info("Configuration changed, reinitializing bot");

  // Clean up existing bot if it exists
  if (bot) {
    await bot.disconnect();
    bot = null;
  }

  // Initialize bot with new configuration
  await initializeBot();
});
