import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import express from 'express';
import { setupSocketHandlers } from './socket/handlers';
import { setupApiRoutes } from './api/routes';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { register } from 'prom-client';
import logger from '@/utils/observability/logger';
import { initializeMetrics } from '@/utils/observability/metrics';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

export function initializeWebServer(bot: MinecraftBot) {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  const expressApp = express();
  const commandHandler = new CommandHandler(bot);

  app.prepare().then(() => {
    // Initialize metrics
    initializeMetrics();

    // Setup API routes
    setupApiRoutes(expressApp, bot);

    // Handle metrics endpoint
    expressApp.get('/metrics', async (req, res) => {
      try {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        logger.error('Failed to collect metrics', { error });
        res.status(500).end();
      }
    });

    // Handle all other routes with Next.js
    expressApp.all('*', (req, res) => {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    });

    const server = createServer(expressApp);
    const io = new Server(server);
    setupSocketHandlers(io, bot, commandHandler);

    server.listen(port, () => {
      logger.info(`Web server ready on http://${hostname}:${port}`);
    });
  });
} 