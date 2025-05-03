import { BaseTask } from './base';
import { Task, TaskParameters, MiningTaskParameters, FarmingTaskParameters, NavigationTaskParameters, InventoryTaskParameters, ChatTaskParameters, QueryTaskParameters } from '@/types/task';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';

// Import all task modules
import { MiningTask } from './mining';
import { NavTask } from './nav';
import { FarmingTask } from './farming';
import { InventoryTask } from './inventory';
import { GatheringTask } from './gathering';

type TaskConstructor<T extends TaskParameters> = new (
  bot: MinecraftBot,
  commandHandler: CommandHandler,
  options: T
) => BaseTask;

interface TaskRegistry {
  [key: string]: TaskConstructor<any>;
}

const taskRegistry: TaskRegistry = {
  mining: MiningTask,
  navigation: NavTask,
  farming: FarmingTask,
  inventory: InventoryTask,
  gathering: GatheringTask
};

function registerTask<T extends TaskParameters>(name: string, taskClass: TaskConstructor<T>): void {
  if (taskRegistry[name]) {
    throw new Error(`Task ${name} is already registered`);
  }
  taskRegistry[name] = taskClass;
}

function getTaskInstance<T extends TaskParameters>(
  name: string,
  bot: MinecraftBot,
  commandHandler: CommandHandler,
  options: T
): BaseTask | null {
  const TaskClass = taskRegistry[name];
  if (!TaskClass) {
    return null;
  }
  return new TaskClass(bot, commandHandler, options);
}

function hasTask(name: string): boolean {
  return name in taskRegistry;
}

function listTasks(): string[] {
  return Object.keys(taskRegistry);
}

// Register built-in tasks
registerTask('mining', MiningTask);
registerTask('navigation', NavTask);
registerTask('farming', FarmingTask);
registerTask('inventory', InventoryTask);

export {
  registerTask,
  getTaskInstance,
  hasTask,
  listTasks,
  TaskRegistry,
  TaskConstructor
}; 