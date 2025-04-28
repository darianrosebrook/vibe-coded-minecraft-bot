import { NextResponse } from 'next/server';
import { botInstance } from '../../../../bot/bot';

export async function GET() {
  if (!botInstance) {
    return NextResponse.json({ error: 'Bot not initialized' }, { status: 503 });
  }

  const mineflayerBot = botInstance.getMineflayerBot();
  const status = {
    connected: mineflayerBot.entity !== null,
    position: mineflayerBot.entity?.position || { x: 0, y: 0, z: 0 },
    health: mineflayerBot.health || 0,
    food: mineflayerBot.food || 0,
    inventory: mineflayerBot.inventory.items(),
    currentTask: null // TODO: Implement getCurrentTask in MinecraftBot
  };

  return NextResponse.json(status);
} 