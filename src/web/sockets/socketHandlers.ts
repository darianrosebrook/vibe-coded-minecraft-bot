import { Server } from 'socket.io';
import { MinecraftBot } from '../../bot/bot';
import { parseTask } from '../../llm/parse';
import { MiningTask, MiningTaskParameters } from '../../tasks/mining';
import { FarmingTask } from '../../tasks/farming';
import { NavigationTask } from '../../tasks/nav';
import { InventoryTask } from '../../tasks/inventory';
import { CommandHandler } from '../../commands';

let bot: MinecraftBot | null = null;
let commandHandler: CommandHandler | null = null;
let taskHandlers: {
  mining: MiningTask;
  farming: FarmingTask;
  navigation: NavigationTask;
  inventory: InventoryTask;
} | null = null;

export function setupSocketHandlers(io: Server, botInstance: MinecraftBot) {
  bot = botInstance;
  commandHandler = new CommandHandler(bot);
  
  // Initialize task handlers
  taskHandlers = {
    mining: new MiningTask(bot, commandHandler, { 
      block: 'stone',
      quantity: 64,
      maxDistance: 32,
      usePathfinding: true
    }),
    farming: new FarmingTask(bot, commandHandler, { cropType: 'wheat', action: 'harvest' }),
    navigation: new NavigationTask(bot, commandHandler, {
      location: {
        x: 0,
        y: 0,
        z: 0
      },
      usePathfinding: true,
      maxDistance: 32
    }),
    inventory: new InventoryTask(bot, commandHandler, { 
      action: 'store',
      itemType: 'stone',
      quantity: 1,
      containerLocation: {
        x: 0,
        y: 0,
        z: 0
      }
    })
  };

  io.on('connection', (socket) => {
    console.log('Client connected');

    // Handle bot status updates
    socket.on('requestBotStatus', () => {
      if (!bot) {
        socket.emit('botStatus', {
          isConnected: false,
          position: { x: 0, y: 0, z: 0 },
          health: 0,
          food: 0,
          inventory: [],
          currentTask: null
        });
        return;
      }

      const mineflayerBot = bot.getMineflayerBot();
      const position = mineflayerBot.entity?.position || { x: 0, y: 0, z: 0 };
      const health = mineflayerBot.health || 0;
      const food = mineflayerBot.food || 0;
      const inventory = mineflayerBot.inventory.items().map(item => ({
        name: item.name,
        count: item.count,
        slot: item.slot
      }));

      socket.emit('botStatus', {
        isConnected: true,
        position: {
          x: Math.floor(position.x),
          y: Math.floor(position.y),
          z: Math.floor(position.z)
        },
        health,
        food,
        inventory,
        currentTask: commandHandler?.getCurrentTaskProgress() || null
      });
    });

    // Handle task commands
    socket.on('executeTask', async (task) => {
      if (!bot || !commandHandler || !taskHandlers) {
        socket.emit('taskUpdate', {
          status: 'error',
          error: 'Bot not initialized'
        });
        return;
      }

      try {
        // Parse the task if it's a natural language command
        let parsedTask = task;
        if (typeof task === 'string') {
          parsedTask = await parseTask(task);
        }

        // Execute the appropriate task handler
        const taskId = `web-${Date.now()}`;
        let taskHandler;

        switch (parsedTask.type) {
          case 'mining':
            taskHandler = new MiningTask(bot, commandHandler, {
              block: (parsedTask.parameters as MiningTaskParameters).block,
              quantity: 64,
              maxDistance: 32,
              usePathfinding: true
            });
            break;
          case 'farming':
            taskHandler = taskHandlers.farming;
            break;
          case 'navigation':
            taskHandler = taskHandlers.navigation;
            break;
          case 'inventory':
            taskHandler = taskHandlers.inventory;
            break;
          default:
            throw new Error(`Unknown task type: ${parsedTask.type}`);
        }

        // Start the task
        socket.emit('taskUpdate', {
          status: 'started',
          taskId,
          task: parsedTask
        });

        // Execute the task
        await taskHandler.execute(parsedTask, taskId);

        // Task completed
        socket.emit('taskUpdate', {
          status: 'completed',
          taskId,
          task: parsedTask
        });
      } catch (error) {
        console.error('Task execution error:', error);
        socket.emit('taskUpdate', {
          status: 'error',
          taskId: task.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
} 