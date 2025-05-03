import { Server, Socket } from 'socket.io';
import { MinecraftBot } from '../../bot/bot';
import { MiningTask } from '../../tasks/mining';
import { FarmingTask } from '../../tasks/farming';
import { InventoryTask } from '../../tasks/inventory';
import { CommandHandler } from '../../commands';
import { MiningTaskParameters, FarmingTaskParameters, InventoryTaskParameters } from '../../types/task';

export function setupSocketHandlers(io: Server, bot: MinecraftBot, commandHandler: CommandHandler) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected');

    // Send initial bot status
    const sendBotStatus = () => {
      if (bot.entity) {
        socket.emit('bot:status', {
          isConnected: true,
          position: bot.entity.position,
          health: bot.health,
          food: bot.food,
          inventory: bot.inventory.items()
        });
      }
    };

    // Send status updates periodically
    const statusInterval = setInterval(sendBotStatus, 1000);

    socket.on('disconnect', () => {
      console.log('Client disconnected');
      clearInterval(statusInterval);
    });

    socket.on('startMining', async (params: Partial<MiningTaskParameters>) => {
      try {
        const task = new MiningTask(bot, commandHandler, {
          targetBlock: params.targetBlock ?? 'stone',
          quantity: params.quantity ?? 1,
          maxDistance: params.maxDistance ?? 32,
          usePathfinding: params.usePathfinding ?? true,
          priority: 50
        });
        
        const result = await task.execute(task, `${socket.id}-${Date.now()}`);
        socket.emit('task:result', result);
      } catch (error) {
        socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('startFarming', async (params: Partial<FarmingTaskParameters>) => {
      try {
        const task = new FarmingTask(bot, commandHandler, {
          cropType: params.cropType ?? 'wheat',
          action: params.action ?? 'harvest',
          area: params.area ?? {
            start: { x: 0, y: 0, z: 0 },
            end: { x: 10, y: 0, z: 10 }
          },
          priority: 50
        });
        
        const result = await task.execute(task, `${socket.id}-${Date.now()}`);
        socket.emit('task:result', result);
      } catch (error) {
        socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('startInventory', async (params: Partial<InventoryTaskParameters>) => {
      try {
        const task = new InventoryTask(bot, commandHandler, {
          operation: params.operation ?? 'check',
          itemType: params.itemType,
          quantity: params.quantity,
          priority: 50
        });
        
        const result = await task.execute(task, `${socket.id}-${Date.now()}`);
        socket.emit('task:result', result);
      } catch (error) {
        socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('bot:command', async (command: string) => {
      try {
        const result = await commandHandler.handleCommand(command, socket.id);
        socket.emit('command:result', result);
      } catch (error) {
        socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  });
} 