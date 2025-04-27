import { Router, Request, Response, RequestHandler } from 'express';
import { botInstance } from '../server';
import { parseTask } from '../../llm/parse';
import { MiningTask, MiningTaskParameters } from '../../tasks/mining';
import { FarmingTask, FarmingTaskParameters } from '../../tasks/farming';
import { InventoryTask, InventoryTaskParameters } from '../../tasks/inventory';
import { CommandHandler } from '../../commands';
import { NavigationTask, NavigationTaskParameters } from '../../tasks/nav';

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
            block: (parsedTask.parameters as MiningTaskParameters).block,
            quantity: 64,
            maxDistance: 32,
            usePathfinding: true
          });
          result = await miningTask.execute(parsedTask, taskId);
          break;
        case 'farming':
          const farmingTask = new FarmingTask(botInstance, commandHandler, {
            cropType: (parsedTask.parameters as FarmingTaskParameters).cropType || 'wheat',
            action: 'harvest',
            radius: 32,
            checkInterval: 5000,
            requiresWater: true,
            minWaterBlocks: 4
          });
          result = await farmingTask.execute(parsedTask, taskId);
          break;
        case 'navigation':
          const navParams = parsedTask.parameters as import('../../tasks/nav').NavigationTaskParameters;
          const navigationTask = new NavigationTask(botInstance, commandHandler, {
            location: navParams.location,
            mode: navParams.mode ?? 'walk',
            avoidWater: navParams.avoidWater ?? false,
            maxDistance: navParams.maxDistance ?? 32,
            usePathfinding: navParams.usePathfinding ?? true
          });
          result = await navigationTask.execute(parsedTask, taskId);
          break;
        case 'inventory':
          const inventoryTask = new InventoryTask(botInstance, commandHandler, {
            action: (parsedTask.parameters as InventoryTaskParameters).action || 'store',
            itemType: (parsedTask.parameters as InventoryTaskParameters).itemType,
            quantity: (parsedTask.parameters as InventoryTaskParameters).quantity || 1
          });
          result = await inventoryTask.execute(parsedTask, taskId);
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