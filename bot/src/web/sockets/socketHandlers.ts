import { Server } from 'socket.io';
import { MinecraftBot } from '../../bot/bot';
import { CommandHandler } from '../../commands';
import logger from '../../utils/observability/logger';
import { OllamaClient } from '../../utils/llmClient';
import { ChatCommand } from '../../types/ml/command';

export function setupSocketHandlers(io: Server, bot: MinecraftBot, commandHandler: CommandHandler) {
  const llmClient = new OllamaClient();

  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Handle bot commands
    socket.on('bot:command', async (command: string) => {
      try {
        const chatCommand: ChatCommand = {
          id: `cmd-${Date.now()}`,
          type: 'chat',
          timestamp: Date.now(),
          priority: 50,
          status: 'pending',
          message: command,
          context: {
            botState: {
              position: bot.getMineflayerBot().entity?.position ?? { x: 0, y: 0, z: 0 },
              health: bot.getMineflayerBot().health,
              food: bot.getMineflayerBot().food,
              inventory: bot.getMineflayerBot().inventory.slots.map(slot => ({
                name: slot?.name ?? 'empty',
                count: slot?.count ?? 0
              }))
            }
          }
        };

        // Emit command status update
        socket.emit('chat:command', chatCommand);

        // Process command through command handler
        await commandHandler.handleCommand('web-client', command);

        // Update command status
        chatCommand.status = 'completed';
        socket.emit('chat:command', chatCommand);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to execute bot command', { error, command });
        socket.emit('chat:error', { message: `Failed to execute command: ${errorMessage}` });
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
          activeTask: bot.getActiveTask(),
          taskProgress: commandHandler.getCurrentTaskProgress()
        };
        socket.emit('bot:status', status);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to get bot status', { error });
        socket.emit('chat:error', { message: `Failed to get status: ${errorMessage}` });
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
          const chatCommand: ChatCommand = {
            id: `cmd-${Date.now()}`,
            type: 'chat',
            timestamp: Date.now(),
            priority: 50,
            status: 'pending',
            message: command,
            context: {
              botState: {
                position: bot.getMineflayerBot().entity?.position ?? { x: 0, y: 0, z: 0 },
                health: bot.getMineflayerBot().health,
                food: bot.getMineflayerBot().food,
                inventory: bot.getMineflayerBot().inventory.slots.map(slot => ({
                  name: slot?.name ?? 'empty',
                  count: slot?.count ?? 0
                }))
              }
            }
          };

          socket.emit('chat:command', chatCommand);
          await commandHandler.handleCommand('web-client', command);
          chatCommand.status = 'completed';
          socket.emit('chat:command', chatCommand);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to process chat message', { error, message });
        socket.emit('chat:error', { message: `Failed to process message: ${errorMessage}` });
      }
    });

    // Listen for bot chat messages
    const mineflayerBot = bot.getMineflayerBot();
    mineflayerBot.on('messagestr', (message: string) => {
      // Extract just the message content without the username prefix
      const content = message.replace(/^<[^>]+>\s*/, '');
      socket.emit('chat:bot', { content, timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });
} 