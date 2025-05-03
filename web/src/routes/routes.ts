import { Router, Request, Response, RequestHandler } from 'express';
import { MinecraftBot } from '../../bot/bot';
import { parseTask } from '../../llm/parse';
import { MiningTask } from '../../tasks/mining';
import { FarmingTask } from '../../tasks/farming';
import { InventoryTask } from '../../tasks/inventory';
import { CommandHandler } from '../../commands';
import { NavTask } from '../../tasks/nav';
import { Vec3 } from 'vec3';
import { MiningTaskParameters, FarmingTaskParameters, NavigationTaskParameters, InventoryTaskParameters } from '@/types/task';

const botInstance = new MinecraftBot({
  host: process.env.MINECRAFT_HOST || 'localhost',
  port: parseInt(process.env.MINECRAFT_PORT || '50000', 10),
  username: process.env.MINECRAFT_USERNAME || 'tob',
  password: process.env.MINECRAFT_PASSWORD || undefined,
  version: process.env.MINECRAFT_VERSION || '1.21.4',
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

export function setupRoutes(app: Router) {
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Get bot status
  app.get('/api/bot/status', ((req: Request, res: Response) => {
    if (!botInstance) {
      return res.status(503).json({ error: 'Bot not initialized' });
    }

    const mineflayerBot = botInstance.getMineflayerBot();
    const status = {
      connected: mineflayerBot.entity !== null,
      position: mineflayerBot.entity?.position || { x: 0, y: 0, z: 0 },
      health: mineflayerBot.health || 0,
      food: mineflayerBot.food || 0,
      inventory: mineflayerBot.inventory.items(),
      currentTask: null // TODO: Implement getCurrentTask in MinecraftBot
    };

    res.json(status);
  }) as RequestHandler);

  // Get task history
  app.get('/api/tasks/history', ((req: Request, res: Response) => {
    if (!botInstance) {
      return res.status(503).json({ error: 'Bot not initialized' });
    }

    res.json([]); // TODO: Implement getTaskHistory in MinecraftBot
  }) as RequestHandler);

  // Execute task
  app.post('/api/tasks/execute', (async (req: Request, res: Response) => {
    if (!botInstance) {
      return res.status(503).json({ error: 'Bot not initialized' });
    }

    const { taskDescription } = req.body;
    if (!taskDescription) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    try {
      const parsedTask = await parseTask(taskDescription);
      const taskId = `web-${Date.now()}`;
      const commandHandler = new CommandHandler(botInstance);

      let result;
      switch (parsedTask.type) {
        case 'mining':
          const miningTask = new MiningTask(botInstance, commandHandler, {
            targetBlock: (parsedTask.parameters as unknown as MiningTaskParameters).targetBlock,
            quantity: 64,
            maxDistance: 32,
            usePathfinding: true
          });
          result = await miningTask.execute(null, taskId);
          break;
        case 'farming':
          const farmingTask = new FarmingTask(botInstance, commandHandler, {
            cropType: (parsedTask.parameters as unknown as FarmingTaskParameters).cropType || 'wheat',
            action: 'harvest',
            area: {
              start: new Vec3(0, 64, 0),
              end: new Vec3(32, 64, 32)
            },
            quantity: 64,
            checkInterval: 5000,
            requiresWater: true,
            minWaterBlocks: 4,
            usePathfinding: true
          });
          result = await farmingTask.execute(null, taskId);
          break;
        case 'navigation':
          const navParams = parsedTask.parameters as unknown as NavigationTaskParameters;
          const navigationTask = new NavTask(botInstance, commandHandler, {
            location: navParams.location,
            mode: 'walk',
            avoidWater: navParams.avoidWater ?? false,
            maxDistance: navParams.maxDistance ?? 32,
            usePathfinding: navParams.usePathfinding ?? true
          });
          result = await navigationTask.execute(null, taskId);
          break;
        case 'inventory':
          const inventoryTask = new InventoryTask(botInstance, commandHandler, {
            operation: (parsedTask.parameters as unknown as InventoryTaskParameters).operation || 'sort',
            itemType: (parsedTask.parameters as unknown as InventoryTaskParameters).itemType,
            quantity: (parsedTask.parameters as unknown as InventoryTaskParameters).quantity
          });
          result = await inventoryTask.execute(null, taskId);
          break;
        default:
          return res.status(400).json({ error: 'Unknown task type' });
      }

      res.json(result);
    } catch (error) {
      console.error('Error executing task:', error);
      res.status(500).json({ error: 'Failed to execute task' });
    }
  }) as RequestHandler);
} 