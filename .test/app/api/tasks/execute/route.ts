import { NextRequest, NextResponse } from 'next/server';
import { botInstance } from '../../../../bot/bot';
import { parseTask } from '../../../../llm/parse';
import { MiningTask, MiningTaskParameters } from '../../../../tasks/mining';
import { FarmingTask, FarmingTaskParameters } from '../../../../tasks/farming';
import { InventoryTask, InventoryTaskParameters } from '../../../../tasks/inventory';
import { CommandHandler } from '../../../../commands';
import { NavTask, NavTaskParameters } from '../../../../tasks/nav';
import { Vec3 } from 'vec3';

export async function POST(request: NextRequest) {
  if (!botInstance) {
    return NextResponse.json({ error: 'Bot not initialized' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { taskDescription } = body;

    if (!taskDescription) {
      return NextResponse.json({ error: 'Task description is required' }, { status: 400 });
    }

    const parsedTask = await parseTask(taskDescription);
    const taskId = `web-${Date.now()}`;
    const commandHandler = new CommandHandler(botInstance);

    let result;
    switch (parsedTask.type) {
      case 'mining':
        const miningTask = new MiningTask(botInstance, commandHandler, {
          targetBlock: (parsedTask.parameters as unknown as MiningTaskParameters).targetBlock,
          quantity: 64,
          radius: 32,
          usePathfinding: true
        });
        result = await miningTask.execute();
        break;
      case 'farming':
        const farmingTask = new FarmingTask(botInstance, commandHandler, {
          cropType: (parsedTask.parameters as unknown as FarmingTaskParameters).cropType || 'wheat',
          action: 'harvest',
          area: {
            start: new Vec3(0, 64, 0),
            end: new Vec3(32, 64, 32)
          },
          radius: 32,
          checkInterval: 5000,
          requiresWater: true,
          minWaterBlocks: 4,
          usePathfinding: true
        });
        result = await farmingTask.execute();
        break;
      case 'navigation':
        const navParams = parsedTask.parameters as unknown as NavTaskParameters;
        const navigationTask = new NavTask(botInstance, commandHandler, {
          destination: navParams.destination,
          avoidWater: navParams.avoidWater ?? false,
          maxDistance: navParams.maxDistance ?? 32,
          usePathfinding: navParams.usePathfinding ?? true
        });
        result = await navigationTask.execute();
        break;
      case 'inventory':
        const inventoryTask = new InventoryTask(botInstance, commandHandler, {
          operation: (parsedTask.parameters as unknown as InventoryTaskParameters).operation || 'sort',
          targetItems: [],
          priorityItems: [],
          useML: true
        });
        result = await inventoryTask.execute();
        break;
      default:
        return NextResponse.json({ error: 'Unknown task type' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error executing task:', error);
    return NextResponse.json({ error: 'Failed to execute task' }, { status: 500 });
  }
} 