import { Server } from 'socket.io';
import { MinecraftBot } from '@/bot/bot';
import logger from '@/utils/observability/logger';
import { OllamaClient } from '@/utils/llmClient';

export function setupSocketHandlers(io: Server, bot: MinecraftBot) {
  const llmClient = new OllamaClient();

  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Handle bot commands
    socket.on('bot:command', (command: string) => {
      try {
        bot.chat(command);
      } catch (error) {
        logger.error('Failed to execute bot command', { error, command });
        socket.emit('error', { message: 'Failed to execute command' });
      }
    });

    // Handle bot status requests
    socket.on('bot:requestStatus', () => {
      try {
        const mineflayerBot = bot.getMineflayerBot();
        const status = {
          health: mineflayerBot.health,
          food: mineflayerBot.food,
          position: mineflayerBot.entity?.position,
          inventory: mineflayerBot.inventory.slots,
          activeTask: bot.getActiveTask()
        };
        socket.emit('bot:status', status);
      } catch (error) {
        logger.error('Failed to get bot status', { error });
        socket.emit('error', { message: 'Failed to get status' });
      }
    });

    // Handle chat messages
    socket.on('chat:message', async (message: string) => {
      try {
        const response = await llmClient.generate(message);
        socket.emit('chat:response', response);

        // If the response contains a command, execute it
        if (response.startsWith('!')) {
          const command = response.slice(1).trim();
          bot.chat(command);
        }
      } catch (error) {
        logger.error('Failed to process chat message', { error, message });
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    // Handle bot position updates
    socket.on('bot:position', () => {
      try {
        const mineflayerBot = bot.getMineflayerBot();
        const position = mineflayerBot.entity?.position;
        if (position) {
          socket.emit('bot:position', position);
        }
      } catch (error) {
        logger.error('Failed to get bot position', { error });
        socket.emit('error', { message: 'Failed to get position' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });
} 