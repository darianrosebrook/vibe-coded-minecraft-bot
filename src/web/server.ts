import { createServer, Server } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketServer } from 'socket.io';
import { setupSocketHandlers } from './sockets/socketHandlers';
import { MinecraftBot } from '../bot/bot';
import { register } from 'prom-client';
import logger from '../utils/observability/logger';
import { initializeMetrics } from '../utils/observability/metrics';
import path from 'path';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

interface ServerStatus {
  isReady: boolean;
  startTime: number;
  lastHealthCheck: number;
  errors: string[];
}

const serverStatus: ServerStatus = {
  isReady: false,
  startTime: 0,
  lastHealthCheck: 0,
  errors: []
};

export async function initializeWebServer(bot: MinecraftBot): Promise<Server> {
  logger.info('Starting web server initialization...', {
    dev,
    hostname,
    port
  });

  const app = next({ 
    dev, 
    hostname, 
    port,
    dir: '/app/src/web'
  });

  const handle = app.getRequestHandler();

  try {
    logger.info('Preparing Next.js app...', { dir: '/app/src/web' });
    await app.prepare();
    logger.info('Next.js app prepared successfully');
  } catch (error) {
    logger.error('Failed to prepare Next.js app', {
      error: error instanceof Error ? error.message : 'Unknown error',
      dir: '/app/src/web'
    });
    throw error;
  }
  
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      
      // Handle health check endpoint
      if (parsedUrl.pathname === '/health') {
        const healthStatus = {
          status: serverStatus.isReady ? 'ok' : 'initializing',
          timestamp: Date.now(),
          uptime: process.uptime(),
          lastHealthCheck: serverStatus.lastHealthCheck,
          errors: serverStatus.errors,
          webServer: {
            isReady: serverStatus.isReady,
            startTime: serverStatus.startTime
          },
          minecraftBot: {
            isConnected: bot.getMineflayerBot()?.player?.username ? true : false,
            username: bot.getMineflayerBot()?.player?.username
          }
        };

        serverStatus.lastHealthCheck = Date.now();
        
        res.writeHead(serverStatus.isReady ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthStatus));
        return;
      }

      // Handle metrics endpoint
      if (parsedUrl.pathname === '/metrics') {
        try {
          res.setHeader('Content-Type', register.contentType);
          res.end(await register.metrics());
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Failed to collect metrics', { error: errorMessage });
          serverStatus.errors.push(`Metrics collection failed: ${errorMessage}`);
          if (serverStatus.errors.length > 10) serverStatus.errors.shift(); // Keep last 10 errors
          res.statusCode = 500;
          res.end();
        }
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Error occurred handling request', { 
        url: req.url,
        error: errorMessage
      });
      serverStatus.errors.push(`Request handler error: ${errorMessage}`);
      if (serverStatus.errors.length > 10) serverStatus.errors.shift(); // Keep last 10 errors
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new SocketServer(server);
  setupSocketHandlers(io, bot);

  // Initialize metrics
  try {
    logger.info('Initializing metrics...');
    initializeMetrics();
    logger.info('Metrics initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize metrics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      serverStatus.isReady = true;
      serverStatus.startTime = Date.now();
      logger.info('Web server ready', {
        url: `http://${hostname}:${port}`,
        startupTime: Date.now() - serverStatus.startTime
      });
      resolve(server);
    });

    server.on('error', (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      serverStatus.errors.push(`Server error: ${errorMessage}`);
      if (serverStatus.errors.length > 10) serverStatus.errors.shift();
      logger.error('Web server error', { error: errorMessage });
      reject(error);
    });
  });
}

export async function shutdownWebServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('Starting web server shutdown...');
    server.close((err) => {
      if (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Error shutting down web server', { error: errorMessage });
        reject(err);
      } else {
        serverStatus.isReady = false;
        logger.info('Web server shut down successfully', {
          uptime: Date.now() - serverStatus.startTime
        });
        resolve();
      }
    });
  });
} 