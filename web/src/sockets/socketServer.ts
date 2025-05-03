import { Server } from 'socket.io';
import { MinecraftBot } from '@bot/bot';
import { CommandHandler } from '@bot/commands';
import { setupSocketHandlers } from '@/sockets/socketHandlers';

export function createSocketServer(server: any, bot: MinecraftBot, commandHandler: CommandHandler): Server {
  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  setupSocketHandlers(io, bot, commandHandler);

  return io;
} 