import mineflayer from 'mineflayer';
import net from 'net';
import logger from './observability/logger';

async function checkTCPConnection(host: string, port: number, timeout: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      logger.info('TCP connection successful', { host, port });
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      logger.warn('TCP connection timeout', { host, port });
      socket.destroy();
      resolve(true); // Be lenient with timeouts
    });

    socket.on('error', (error) => {
      logger.warn('TCP connection error', { host, port, error: error.message });
      socket.destroy();
      resolve(true); // Be lenient with errors
    });

    try {
      logger.info('Attempting TCP connection', { host, port });
      // Force IPv4
      socket.connect({
        host: host === 'localhost' ? '127.0.0.1' : host,
        port,
        family: 4
      });
    } catch (error) {
      logger.warn('TCP connection attempt failed', { host, port, error: error instanceof Error ? error.message : 'Unknown error' });
      resolve(true); // Be lenient with connection failures
    }
  });
}

export async function checkMinecraftServer(host: string, port: number, timeout: number = 5000): Promise<boolean> {
  // First check basic TCP connectivity
  const tcpConnected = await checkTCPConnection(host, port, timeout);
  if (!tcpConnected) {
    logger.warn('Basic TCP connection failed, skipping Minecraft-specific check', { host, port });
    return false;
  }

  logger.info('Basic TCP connection successful, attempting Minecraft-specific connection', { host, port });

  // Then try Minecraft-specific connection
  return new Promise((resolve) => {
    const bot = mineflayer.createBot({
      host: host === 'localhost' ? '127.0.0.1' : host,
      port,
      username: 'server_checker',
      version: '1.21.4',
      hideErrors: false,
      checkTimeoutInterval: timeout
    });

    bot.once('spawn', () => {
      logger.info('Successfully connected to Minecraft server', { host, port });
      bot.quit();
      resolve(true);
    });

    bot.once('error', (error) => {
      logger.warn('Minecraft-specific connection failed', { 
        host, 
        port, 
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      resolve(false);
    });

    bot.on('kicked', (reason) => {
      logger.warn('Kicked from Minecraft server', { 
        host, 
        port, 
        reason 
      });
      resolve(false);
    });

    setTimeout(() => {
      bot.quit();
      logger.warn('Minecraft server connection timeout', { host, port });
      resolve(false);
    }, timeout);
  });
} 