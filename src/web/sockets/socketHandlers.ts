import { Server, Socket } from 'socket.io';
import { MinecraftBot } from '../../bot/bot';
import { MiningTask } from '../../tasks/mining';
import { FarmingTask } from '../../tasks/farming';
import { InventoryTask } from '../../tasks/inventory';
import { CommandHandler } from '../../commands';
import { MiningTaskParameters, FarmingTaskParameters, InventoryTaskParameters } from '@/types/task';

export function setupSocketHandlers(io: Server, bot: MinecraftBot, commandHandler: CommandHandler) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected');

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });

    socket.on('startMining', async (params: Partial<MiningTaskParameters>) => {
      try {
        const task = new MiningTask(bot, commandHandler, {
          targetBlock: params.targetBlock || 'stone',
          quantity: params.quantity || 1,
          maxDistance: params.maxDistance || 32,
          usePathfinding: params.usePathfinding || true,
          priority: 50
        });
        
        const result = await task.execute();
        socket.emit('taskResult', result);
      } catch (error) {
        socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('startFarming', async (params: Partial<FarmingTaskParameters>) => {
      try {
        const task = new FarmingTask(bot, commandHandler, {
          cropType: params.cropType || 'wheat',
          action: params.action || 'harvest',
          area: params.area || {
            start: { x: 0, y: 0, z: 0 },
            end: { x: 10, y: 0, z: 10 }
          },
          priority: 50
        });
        
        const result = await task.execute();
        socket.emit('taskResult', result);
      } catch (error) {
        socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('startInventory', async (params: Partial<InventoryTaskParameters>) => {
      try {
        const task = new InventoryTask(bot, commandHandler, {
          operation: params.operation || 'check',
          itemType: params.itemType,
          quantity: params.quantity,
          priority: 50
        });
        
        const result = await task.execute();
        socket.emit('taskResult', result);
      } catch (error) {
        socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('botCommand', async (command: string) => {
      try {
        const result = await commandHandler.handleCommand(command);
        socket.emit('commandResult', result);
      } catch (error) {
        socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  });
} 