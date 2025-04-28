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
import logger from "./utils/observability/logger";
import { initializeWebServer } from "./web/server";

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

async function initializeBot(): Promise<void> {
  let config: Config | null = null;
  try {
    // Initialize config manager first
    await configManager.initialize();
    config = configManager.getConfig();

    // Create new bot instance with current config
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

    // Initialize world tracker
    worldTracker = new WorldTracker(bot);

    // Initialize parser
    initializeParser(bot);

    // Initialize command handler
    commandHandler = new CommandHandler(bot);

    // Register tasks with required options
    commandHandler.registerTask(
      "mining",
      new MiningTask(bot, commandHandler, {
        targetBlock: "stone",
        quantity: 64,
        radius: 32,
        usePathfinding: true,
      })
    );

    commandHandler.registerTask(
      "farming",
      new FarmingTask(bot, commandHandler, {
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
        }
      })
    );

    commandHandler.registerTask(
      "navigation",
      new NavTask(bot, commandHandler, {
        destination: new Vec3(100, 64, -200),
        usePathfinding: true,
        maxDistance: 32,
      })
    );

    commandHandler.registerTask(
      "inventory",
      new InventoryTask(bot, commandHandler, {
        operation: "sort",
        targetItems: ["diamond"],
        priorityItems: ["diamond"]
      })
    );

    commandHandler.registerTask(
      "query",
      new QueryTask(bot, commandHandler, {
        queryType: "block",
        target: "diamond_ore",
        radius: 32,
      })
    );

    commandHandler.registerTask(
      "redstone",
      new RedstoneTask(bot, commandHandler, {
        circuitType: "analyze",
        area: {
          start: new Vec3(0, 64, 0),
          end: new Vec3(16, 80, 16),
        },
        devices: [
          { type: "repeater", position: new Vec3(8, 64, 8) },
          { type: "comparator", position: new Vec3(8, 64, 12) }
        ]
      })
    );

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
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
      config: {
        host: config?.MINECRAFT_HOST,
        port: config?.MINECRAFT_PORT,
        username: config?.MINECRAFT_USERNAME,
        version: config?.MINECRAFT_VERSION,
      },
    });
    process.exit(1);
  }
}

// Initialize web server
if (bot) {
  initializeWebServer(bot);
}

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

// Initialize bot with current configuration
initializeBot();

// Handle process termination
process.on("SIGINT", async () => {
  logger.info("Shutting down...");

  // Clean up bot
  if (bot) {
    await bot.disconnect();
  }

  // Clean up config manager
  configManager.stop();

  // Unsubscribe from config changes
  unsubscribe();

  // Close the build log stream
  buildLogStream.end();

  process.exit(0);
});
