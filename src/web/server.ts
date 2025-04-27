import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { setupSocketHandlers } from './sockets/socketHandlers';
import { setupRoutes } from './routes/routes';
import { MinecraftBot } from '../bot/bot';
import { register } from 'prom-client';
import logger, { stream } from '../utils/observability/logger';
import morgan from 'morgan';
import { metrics, initializeMetrics } from '../utils/observability/metrics';

let botInstance: MinecraftBot | null = null;

export function initializeWebServer(bot: MinecraftBot) {
  botInstance = bot;
  
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  // Middleware
  app.use(morgan('combined', { stream }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Setup routes
  setupRoutes(app);

  // Setup socket handlers
  setupSocketHandlers(io, bot);

  // Health check endpoint
  app.get('/health', (req, res) => {
    const health = {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
    };
    res.json(health);
  });

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Failed to collect metrics', { error });
      res.status(500).end();
    }
  });

  // Initialize metrics
  initializeMetrics();

  // Start server
  const PORT = process.env.WEB_PORT || 3000;
  server.listen(PORT, () => {
    logger.info(`Web dashboard running on port ${PORT}`);
  });

  return { app, server, io };
}

export { botInstance }; 