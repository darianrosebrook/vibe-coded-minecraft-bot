import express from 'express';
import { createServer } from 'http';
import { MinecraftBot } from '@bot/bot';
import { CommandHandler } from '@bot/commands';
import { logger } from '@bot/utils/observability/logger';
import { initializeMetrics } from '@bot/utils/observability/metrics';
import { createApiRouter } from '@/routes/api';
import { createSocketServer } from '@/sockets/socketServer';

export async function startServer(port: number = 3001) {
  const app = express();
  const server = createServer(app);
  
  // Initialize bot and command handler
  const bot = new MinecraftBot();
  const commandHandler = new CommandHandler(bot);
  
  // Initialize metrics
  initializeMetrics();
  
  // Setup middleware
  app.use(express.json());
  
  // Setup routes
  app.use('/api', createApiRouter(bot, commandHandler));
  
  // Setup socket server
  const io = createSocketServer(server, bot, commandHandler);
  
  // Start server
  server.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
  
  return { app, server, io, bot };
} 