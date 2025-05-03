import logger from '@/utils/observability/logger'; 
import { MinecraftBot } from "@/bot/bot";
import { MiningTask } from "@/tasks/mining";
import { FarmingTask } from "@/tasks/farming";
import { NavTask } from "@/tasks/nav";
import { InventoryTask } from "@/tasks/inventory";
import { CommandHandler } from "@/commands";
import { WorldTracker } from "@/bot/worldTracking";
import * as fs from "fs";
import * as path from "path";
import { QueryTask } from "@/tasks/query";
import { RedstoneTask } from "@/tasks/redstone"; 
import { Vec3 } from "vec3";
import { configManager } from "@/config/configManager";
import { Config } from "@/config/config";
import { initializeParser } from "@/llm/parse";
import { MLManager } from "@/ml/manager";
import { PerformanceTracker } from "@/utils/observability/performance";
import { checkMinecraftServer } from "@/utils/serverCheck";

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
let isCleaningUp = false;

// Cleanup function to handle graceful shutdown
async function cleanup() {
  if (isCleaningUp) {
    logger.info('Cleanup already in progress, skipping...');
    return;
  }
  
  isCleaningUp = true;
  logger.info('Starting cleanup...');
  
  try {
    // Close build log stream
    if (buildLogStream) {
      logger.info('Closing build log stream...');
      buildLogStream.end();
    }

    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Shutdown bot
    if (bot) {
      logger.info('Shutting down bot...');
      await bot.disconnect();
      bot = null;
    }

    // Cleanup command handler
    if (commandHandler) {
      logger.info('Shutting down command handler...');
      commandHandler = null;
    }

    // Cleanup world tracker
    if (worldTracker) {
      logger.info('Shutting down world tracker...');
      worldTracker = null;
    }

    // Cleanup Docker containers if running in Docker
    if (process.env.RUNNING_IN_DOCKER === 'true') {
      logger.info('Cleaning up Docker containers...');
      try {
        const { execSync } = require('child_process');
        // Stop and remove all containers related to this project
        execSync('docker ps -a --filter "name=minecraft-bot" -q | xargs -r docker stop | xargs -r docker rm', { stdio: 'inherit' });
        logger.info('Docker containers cleaned up successfully');
      } catch (error) {
        logger.error('Error cleaning up Docker containers', { error });
      }
    }

    logger.info('Cleanup completed');
  } catch (error) {
    logger.error('Error during cleanup', { error });
  } finally {
    isCleaningUp = false;
    process.exit(0);
  }
}

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

    // Check Minecraft server availability before proceeding
    logger.info('Checking Minecraft server availability...', {
      host: config.MINECRAFT_HOST,
      port: config.MINECRAFT_PORT
    });

    const isServerAvailable = await checkMinecraftServer(
      config.MINECRAFT_HOST,
      config.MINECRAFT_PORT
    );

    if (!isServerAvailable) {
      throw new Error('Minecraft server is not available. Please ensure the server is running and accessible.');
    }

    logger.info('Minecraft server is available, proceeding with bot initialization');

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

    // Initialize command handler
    commandHandler = new CommandHandler(bot);
    await commandHandler.initialize();

    // Initialize performance tracker
    logger.info('Initializing performance tracker...');
    const performanceTracker = new PerformanceTracker();
    logger.info('Performance tracker initialized');

    // Initialize ML manager
    logger.info('Initializing ML manager...');
    const mlManager = new MLManager(bot, {}, performanceTracker);
    await mlManager.initialize();
    logger.info('ML manager initialized');

    // Initialize world tracker
    logger.info('Initializing world tracker...');
    worldTracker = new WorldTracker(bot);
    logger.info('World tracker initialized');

    // Initialize parser
    logger.info('Initializing parser...');
    initializeParser(bot);
    logger.info('Parser initialized');

    // Create and initialize tasks
    logger.info('Initializing tasks...');
    const miningTask = new MiningTask(bot, commandHandler, {
      targetBlock: "stone",
      quantity: 64,
      radius: 32,
      usePathfinding: true,
      dataCollector: mlManager.getDataCollector()
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
      dataCollector: mlManager.getDataCollector()
    });
    await farmingTask.initialize();

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
