import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './sockets/socketHandlers';
import { MinecraftBot } from '@/bot/bot';
import { register } from 'prom-client';
import logger from '@/utils/observability/logger';
import { initializeMetrics } from '@/utils/observability/metrics';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

export function initializeWebServer(bot: MinecraftBot) {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        
        // Handle health check endpoint
        if (parsedUrl.pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            timestamp: Date.now(),
            uptime: process.uptime(),
          }));
          return;
        }

        // Handle metrics endpoint
        if (parsedUrl.pathname === '/metrics') {
          try {
            res.setHeader('Content-Type', register.contentType);
            res.end(await register.metrics());
          } catch (error) {
            logger.error('Failed to collect metrics', { error });
            res.statusCode = 500;
            res.end();
          }
          return;
        }

        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    const io = new Server(server);
    setupSocketHandlers(io, bot);

    // Initialize metrics
    initializeMetrics();

    server.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  });
} 