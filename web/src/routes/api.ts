import { Router } from 'express';
import { MinecraftBot } from '@bot/bot';
import { CommandHandler } from '@bot/commands';
import { logger } from '@bot/utils/observability/logger';

export function createApiRouter(bot: MinecraftBot, commandHandler: CommandHandler): Router {
  const router = Router();

  router.get('/status', (req, res) => {
    res.json({
      status: bot.isConnected() ? 'connected' : 'disconnected',
      position: bot.getPosition(),
      health: bot.getHealth(),
      inventory: bot.getInventory()
    });
  });

  router.post('/command', async (req, res) => {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const result = await commandHandler.handleCommand(command, 'api');
      res.json(result);
    } catch (error) {
      logger.error('API command error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return router;
} 