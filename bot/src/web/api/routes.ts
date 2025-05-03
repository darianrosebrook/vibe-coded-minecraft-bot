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
import logger from '@/utils/observability/logger';

export function setupApiRoutes(app: Router, bot: MinecraftBot) {
  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime()
    });
  });

  // Get bot status
  app.get('/api/bot/status', ((req: Request, res: Response) => {
    if (!bot) {
      return res.status(503).json({ error: 'Bot not initialized' });
    }

    const mineflayerBot = bot.getMineflayerBot();
    const status = {
      connected: mineflayerBot.entity !== null,
      position: mineflayerBot.entity?.position ?? { x: 0, y: 0, z: 0 },
      health: mineflayerBot.health ?? 0,
      food: mineflayerBot.food ?? 0,
      inventory: mineflayerBot.inventory.items(),
      currentTask: bot.getActiveTask()
    };

    res.json(status);
  }) as RequestHandler);

  // Get task history
  app.get('/api/tasks/history', ((req: Request, res: Response) => {
    if (!bot) {
      return res.status(503).json({ error: 'Bot not initialized' });
    }

    const history = bot.getTaskHistory();
    res.json(history);
  }) as RequestHandler);

  // Execute task
  app.post('/api/tasks/execute', (async (req: Request, res: Response) => {
    if (!bot) {
      return res.status(503).json({ error: 'Bot not initialized' });
    }

    const { taskDescription } = req.body;
    if (!taskDescription) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    try {
      const parsedTask = await parseTask(taskDescription);
      const taskId = `web-${Date.now()}`;
      const commandHandler = new CommandHandler(bot);

      let result;
      switch (parsedTask.type) {
        case 'mining':
          const miningTask = new MiningTask(bot, commandHandler, {
            targetBlock: (parsedTask.parameters as unknown as MiningTaskParameters).targetBlock,
            quantity: 64,
            maxDistance: 32,
            usePathfinding: true
          });
          result = await miningTask.execute(null, taskId);
          break;
        case 'farming':
          const farmingTask = new FarmingTask(bot, commandHandler, {
            cropType: (parsedTask.parameters as unknown as FarmingTaskParameters).cropType ?? 'wheat',
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
          const navigationTask = new NavTask(bot, commandHandler, {
            location: navParams.location,
            mode: 'walk',
            avoidWater: navParams.avoidWater ?? false,
            maxDistance: navParams.maxDistance ?? 32,
            usePathfinding: navParams.usePathfinding ?? true
          });
          result = await navigationTask.execute(null, taskId);
          break;
        case 'inventory':
          const inventoryTask = new InventoryTask(bot, commandHandler, {
            operation: (parsedTask.parameters as unknown as InventoryTaskParameters).operation ?? 'sort',
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
      logger.error('Error executing task', { error, taskDescription });
      res.status(500).json({ error: 'Failed to execute task' });
    }
  }) as RequestHandler);
} 