import { Task } from '../types/task';
import { TaskQueue, TaskNode } from '../queue/queue';
import { Conflict, ConflictType, ResourceConflict, LocationConflict, ToolConflict, TimeConflict } from './types';

export class ConflictDetector {
  private queue: TaskQueue;

  constructor(queue: TaskQueue) {
    this.queue = queue;
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
      if (task.requirements?.items) {
        for (const item of task.requirements.items) {
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
      if (task.data?.position && 
          typeof task.data.position === 'object' &&
          'x' in task.data.position &&
          'y' in task.data.position &&
          'z' in task.data.position &&
          typeof task.data.position.x === 'number' && 
          typeof task.data.position.y === 'number' && 
          typeof task.data.position.z === 'number') {
        const key = `${task.data.position.x},${task.data.position.y},${task.data.position.z}`;
        if (!locationRequirements.has(key)) {
          locationRequirements.set(key, []);
        }
        locationRequirements.get(key)!.push({
          taskId: task.id,
          position: {
            x: task.data.position.x,
            y: task.data.position.y,
            z: task.data.position.z
          },
          radius: typeof task.data.radius === 'number' ? task.data.radius : 1
        });
      }

      // Tool requirements
      if (task.requirements?.tools) {
        for (const tool of task.requirements.tools) {
          if (!toolRequirements.has(tool.type)) {
            toolRequirements.set(tool.type, []);
          }
          toolRequirements.get(tool.type)!.push({
            taskId: task.id
          });
        }
      }

      // Time requirements
      if (task.data?.startTime && 
          task.data?.endTime && 
          typeof task.data.startTime === 'number' && 
          typeof task.data.endTime === 'number') {
        const key = `${task.data.startTime}-${task.data.endTime}`;
        if (!timeRequirements.has(key)) {
          timeRequirements.set(key, []);
        }
        timeRequirements.get(key)!.push({
          taskId: task.id,
          start: task.data.startTime,
          end: task.data.endTime
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
            
            if (this.isLocationOverlap(loc1, loc2)) {
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
            
            if (this.isTimeOverlap(range1, range2)) {
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
    // This would typically query the game state or inventory
    // For now, return a mock value
    return 100;
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
} 