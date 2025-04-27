import { MinecraftBot } from './bot/bot';
import { MiningTask } from './tasks/mining';
import { FarmingTask } from './tasks/farming';
import { NavigationTask } from './tasks/nav';
import { InventoryTask } from './tasks/inventory';
import { parseTask, initializeParser } from './llm/parse';
import { RedstoneTask } from './tasks/redstone';
import { QueryTask } from './tasks/query';
import { CommandHandler } from './commands';
import { configManager } from './config/configManager';
import { Config } from './types/config';
import { initializeWebServer } from './web/server';
import logger from './utils/observability/logger';
import { WorldTracker } from './bot/worldTracking';
import fs from 'fs';
import path from 'path';

// Ensure buildLogs directory exists
const buildLogsDir = path.join(process.cwd(), 'buildLogs');
if (!fs.existsSync(buildLogsDir)) {
  fs.mkdirSync(buildLogsDir);
}

// Create a write stream for build logs
const buildLogStream = fs.createWriteStream(path.join(buildLogsDir, 'latest'), { flags: 'w' });

// Override console.log to write to both console and build log file
const originalConsoleLog = console.log;
console.log = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  buildLogStream.write(`[${timestamp}] ${message}\n`);
  originalConsoleLog(...args);
};

// Override console.error to write to both console and build log file
const originalConsoleError = console.error;
console.error = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
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
    });

    // Initialize world tracker
    worldTracker = new WorldTracker(bot);

    // Initialize parser
    initializeParser(bot);

    // Initialize command handler
    commandHandler = new CommandHandler(bot);

    // Register tasks with required options
    commandHandler.registerTask('mining', new MiningTask(bot, commandHandler, {
      block: 'stone',
      quantity: 64,
      maxDistance: 32,
      usePathfinding: true
    }));

    commandHandler.registerTask('farming', new FarmingTask(bot, commandHandler, {
      cropType: 'wheat',
      action: 'harvest',
      radius: 32,
      checkInterval: 5000,
      requiresWater: true,
      minWaterBlocks: 4
    }));

    commandHandler.registerTask('navigation', new NavigationTask(bot, commandHandler, {
      location: {
        x: 100,
        y: 64,
        z: -200
      },
      usePathfinding: true,
      maxDistance: 32
    }));

    commandHandler.registerTask('inventory', new InventoryTask(bot, commandHandler, {
      action: 'store',
      itemType: 'diamond',
      quantity: 1
    }));

    commandHandler.registerTask('query', new QueryTask(bot, commandHandler, {
      queryType: 'inventory'
    }));

    commandHandler.registerTask('redstone', new RedstoneTask(bot, commandHandler, {
      action: 'toggle',
      target: {
        type: 'redstone_torch',
        position: { x: 0, y: 0, z: 0 },
        state: false
      },
      circuit: {
        devices: [],
        connections: []
      },
      farmConfig: {
        cropTypes: ['wheat'],
        radius: 32,
        checkInterval: 5000,
        requiresWater: true,
        minWaterBlocks: 4
      }
    }));

    // Handle chat commands
    const mineflayerBot = bot.getMineflayerBot();
    mineflayerBot.on('chat', async (username: string, message: string) => { 
      // Only log messages from other players, not the bot's own messages
      if (username !== mineflayerBot.username) {
        logger.info('Player message', { 
          username,
          content: message 
        });
      }
      if (commandHandler) {
        await commandHandler.handleCommand(username, message);
      }
    });

    // Log bot's chat messages
    mineflayerBot.on('messagestr', (message: string) => {
      // Extract just the message content without the username prefix
      const content = message.replace(/^<[^>]+>\s*/, '');
      logger.info('Bot response', { 
        content 
      });
    });

    logger.info('Bot initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize bot', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      config: {
        host: config?.MINECRAFT_HOST,
        port: config?.MINECRAFT_PORT,
        username: config?.MINECRAFT_USERNAME,
        version: config?.MINECRAFT_VERSION
      }
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
  logger.info('Configuration changed, reinitializing bot');
  
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
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  
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