import { Task, TaskParameters, MiningTaskParameters, NavigationTaskParameters } from '@/types/task';
import { TaskQueue } from '../queue/queue';
import { Conflict, ConflictType } from '@/types/task';
import { GameState } from '@/llm/context/manager';
export class ConflictDetector {
  private queue: TaskQueue;
  private gameState: GameState;

  constructor(queue: TaskQueue, gameState: GameState) {
    this.queue = queue;
    this.gameState = gameState;
  }

  async detectConflicts(tasks: Task[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Group tasks by their requirements
    const resourceRequirements = new Map<string, { taskId: string; quantity: number }[]>();
    const locationRequirements = new Map<string, { taskId: string; position: { x: number; y: number; z: number }; radius: number }[]>();
    const toolRequirements = new Map<string, { taskId: string }[]>();
    const timeRequirements = new Map<string, { taskId: string; start: number; end: number }[]>();

    // Collect requirements from all tasks
    for (const task of tasks) {
      // Resource requirements
      if (this.isMiningTask(task.parameters) && task.parameters.requirements?.items) {
        const items = task.parameters.requirements.items;
        for (const item of items) {
          if (!resourceRequirements.has(item.type)) {
            resourceRequirements.set(item.type, []);
          }
          resourceRequirements.get(item.type)!.push({
            taskId: task.id,
            quantity: item.quantity
          });
        }
      }

      // Location requirements
      if (this.isNavigationTask(task.parameters) && task.parameters.location) {
        const location = task.parameters.location;
        const key = `${location.x},${location.y},${location.z}`;
        if (!locationRequirements.has(key)) {
          locationRequirements.set(key, []);
        }
        locationRequirements.get(key)!.push({
          taskId: task.id,
          position: {
            x: location.x,
            y: location.y,
            z: location.z
          },
          radius: task.parameters.radius || 1
        });
      }

      // Tool requirements
      if (this.isMiningTask(task.parameters) && task.parameters.tool) {
        const tool = task.parameters.tool;
        if (!toolRequirements.has(tool)) {
          toolRequirements.set(tool, []);
        }
        toolRequirements.get(tool)!.push({
          taskId: task.id
        });
      }

      // Time requirements
      if (this.isMiningTask(task.parameters) && task.parameters.timeout) {
        const startTime = Date.now();
        const endTime = startTime + task.parameters.timeout;
        const key = `${startTime}-${endTime}`;
        if (!timeRequirements.has(key)) {
          timeRequirements.set(key, []);
        }
        timeRequirements.get(key)!.push({
          taskId: task.id,
          start: startTime,
          end: endTime
        });
      }
    }

    // Check for resource conflicts
    for (const [resourceType, requirements] of resourceRequirements) {
      if (requirements.length > 1) {
        const totalRequired = requirements.reduce((sum, req) => sum + req.quantity, 0);
        const available = this.getAvailableResourceQuantity(resourceType);

        if (totalRequired > available) {
          conflicts.push({
            type: ConflictType.RESOURCE,
            resourceType,
            requiredQuantity: totalRequired,
            availableQuantity: available,
            conflictingTasks: requirements.map(req => req.taskId)
          });
        }
      }
    }

    // Check for location conflicts
    for (const [, locations] of locationRequirements) {
      if (locations.length > 1) {
        for (let i = 0; i < locations.length; i++) {
          for (let j = i + 1; j < locations.length; j++) {
            const loc1 = locations[i];
            const loc2 = locations[j];

            if (loc1 && loc2 && this.isLocationOverlap(loc1, loc2)) {
              conflicts.push({
                type: ConflictType.LOCATION,
                position: loc1.position,
                radius: Math.max(loc1.radius, loc2.radius),
                conflictingTasks: [loc1.taskId, loc2.taskId]
              });
            }
          }
        }
      }
    }

    // Check for tool conflicts
    for (const [toolType, requirements] of toolRequirements) {
      if (requirements.length > 1) {
        conflicts.push({
          type: ConflictType.TOOL,
          toolType,
          conflictingTasks: requirements.map(req => req.taskId)
        });
      }
    }

    // Check for time conflicts
    for (const [, timeRanges] of timeRequirements) {
      if (timeRanges.length > 1) {
        for (let i = 0; i < timeRanges.length; i++) {
          for (let j = i + 1; j < timeRanges.length; j++) {
            const range1 = timeRanges[i];
            const range2 = timeRanges[j];

            if (range1 && range2 && this.isTimeOverlap(range1, range2)) {
              conflicts.push({
                type: ConflictType.TIME,
                startTime: Math.max(range1.start, range2.start),
                endTime: Math.min(range1.end, range2.end),
                conflictingTasks: [range1.taskId, range2.taskId]
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  private getAvailableResourceQuantity(resourceType: string): number {
    const item = this.gameState.inventory.items.find(item => item.type === resourceType);
    return item ? item.quantity : 0;
  }

  private isLocationOverlap(
    loc1: { position: { x: number; y: number; z: number }; radius: number },
    loc2: { position: { x: number; y: number; z: number }; radius: number }
  ): boolean {
    const distance = Math.sqrt(
      Math.pow(loc1.position.x - loc2.position.x, 2) +
      Math.pow(loc1.position.y - loc2.position.y, 2) +
      Math.pow(loc1.position.z - loc2.position.z, 2)
    );
    return distance < (loc1.radius + loc2.radius);
  }

  private isTimeOverlap(
    range1: { start: number; end: number },
    range2: { start: number; end: number }
  ): boolean {
    return !(range1.end < range2.start || range2.end < range1.start);
  }

  async detectConflictsForTask(task: Task): Promise<Conflict[]> {
    const runningTasks = this.queue.getRunningTasks();
    const pendingTasks = this.queue.getReadyTasks();
    return this.detectConflicts([task, ...runningTasks, ...pendingTasks]);
  }

  private isMiningTask(parameters: TaskParameters): parameters is MiningTaskParameters {
    return 'targetBlock' in parameters;
  }

  private isNavigationTask(parameters: TaskParameters): parameters is NavigationTaskParameters {
    return 'location' in parameters;
  }
} 