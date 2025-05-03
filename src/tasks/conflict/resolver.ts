import { Task } from '@/types/task';
import { TaskQueue, TaskNode } from '../queue/queue';
import { Conflict, ConflictResolution, ConflictType, ResourceConflict, LocationConflict, ToolConflict, TimeConflict } from '@/types';
import { ConflictDetector } from './detector';
import { TaskPriority } from '@/types/task';
import { MinecraftBot } from '@/bot/bot';
import { GameState } from '@/llm/context/manager';

export class ConflictResolver {
  private queue: TaskQueue;
  private detector: ConflictDetector;
  private bot: MinecraftBot;
  constructor(queue: TaskQueue, bot: MinecraftBot) {
    this.bot = bot;
    this.queue = queue;
    
    // Get initial empty game state - ConflictDetector will initialize properly
    const gameState: GameState = {
      position: this.bot.getMineflayerBot().entity.position,
      health: this.bot.getMineflayerBot().health,
      food: this.bot.getMineflayerBot().food,
      inventory: {
        items: [],
        totalSlots: 36,
        usedSlots: 0
      },
      biome: '',
      timeOfDay: 0,
      isRaining: false,
      nearbyBlocks: [],
      nearbyEntities: [],
      movement: {
        velocity: this.bot.getMineflayerBot().entity.velocity,
        yaw: 0,
        pitch: 0,
        control: {
          sprint: false,
          sneak: false
        }
      },
      environment: {
        blockAtFeet: '',
        blockAtHead: '',
        lightLevel: 0,
        isInWater: false,
        onGround: true
      },
      recentTasks: []
    };
    
    this.detector = new ConflictDetector(queue, gameState);
  }

  async resolveConflicts(conflicts: Conflict[]): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  private getPriorityValue(priority?: TaskPriority): number {
    if (!priority) {
      return 0;
    }

    switch (priority) {
      case TaskPriority.HIGH: return 3;
      case TaskPriority.MEDIUM: return 2;
      case TaskPriority.LOW: return 1;
      default: return 0;
    }
  }

  private async resolveConflict(conflict: Conflict): Promise<ConflictResolution> {
    if (!conflict) {
      throw new Error('Conflict object is required');
    }

    switch (conflict.type) {
      case ConflictType.RESOURCE:
        return this.resolveResourceConflict(conflict as ResourceConflict);
      case ConflictType.LOCATION:
        return this.resolveLocationConflict(conflict as LocationConflict);
      case ConflictType.TOOL:
        return this.resolveToolConflict(conflict as ToolConflict);
      case ConflictType.TIME:
        return this.resolveTimeConflict(conflict as TimeConflict);
      default:
        const _exhaustiveCheck: never = conflict;
        throw new Error(`Unknown conflict type: ${_exhaustiveCheck}`);
    }
  }

  private async resolveResourceConflict(conflict: ResourceConflict): Promise<ConflictResolution> {
    const tasks = conflict.conflictingTasks
      .map(taskId => this.queue.getTaskState(taskId))
      .filter((task): task is TaskNode => task !== undefined);

    if (tasks.length === 0) {
      throw new Error('No valid tasks found for resource conflict resolution');
    }

    // Sort tasks by priority, defaulting to 0 if priority is undefined
    const sortedTasks = tasks.sort((a, b) => this.getPriorityValue(b.task.priority) - this.getPriorityValue(a.task.priority));

    // Try to resolve by adjusting quantities
    const totalAvailable = this.getAvailableResourceQuantity(conflict.resourceType);
    let remaining = totalAvailable;

    for (const task of sortedTasks) {
      const required = this.getTaskResourceRequirement(task.task.id, conflict.resourceType);
      if (required <= remaining) {
        remaining -= required;
      } else {
        return {
          conflict,
          resolution: 'AUTO',
          resolved: false,
          action: 'ADJUST_QUANTITY',
          message: `Insufficient ${conflict.resourceType} for all tasks. Adjusting quantities.`
        };
      }
    }

    return {
      conflict,
      resolution: 'AUTO',
      resolved: true,
      action: 'ADJUST_QUANTITY',
      message: `Successfully allocated ${conflict.resourceType} resources.`
    };
  }

  private async resolveLocationConflict(conflict: LocationConflict): Promise<ConflictResolution> {
    const tasks = conflict.conflictingTasks
      .map(taskId => this.queue.getTaskState(taskId))
      .filter((task): task is TaskNode => task !== undefined);

    // Sort tasks by priority, defaulting to 0 if priority is undefined
    const sortedTasks = tasks.sort((a, b) => this.getPriorityValue(b.task.priority) - this.getPriorityValue(a.task.priority));

    // Try to find alternative locations
    for (let i = 1; i < sortedTasks.length; i++) {
      const task = sortedTasks[i];
      if (task) {
        const alternativeLocation = await this.findAlternativeLocation(task.task.id, conflict.position);

        if (alternativeLocation) {
          return {
            conflict,
            resolution: 'AUTO',
            resolved: true,
            action: 'MOVE_LOCATION',
            message: `Found alternative location for task ${task.task.id}.`
          };
        }
      }
    }

    return {
      conflict,
      resolution: 'AUTO',
      resolved: false,
      action: 'MOVE_LOCATION',
      message: 'Could not find alternative locations for conflicting tasks.'
    };
  }

  private async resolveToolConflict(conflict: ToolConflict): Promise<ConflictResolution> {
    const tasks = conflict.conflictingTasks
      .map(taskId => this.queue.getTaskState(taskId))
      .filter((task): task is TaskNode => task !== undefined);

    // Sort tasks by priority, defaulting to 0 if priority is undefined
    const sortedTasks = tasks.sort((a, b) => this.getPriorityValue(b.task.priority) - this.getPriorityValue(a.task.priority));

    // Try to find alternative tools
    for (let i = 1; i < sortedTasks.length; i++) {
      const task = sortedTasks[i];
      if (task) {
        const alternativeTool = await this.findAlternativeTool(task.task.id, conflict.toolType);

        if (alternativeTool) {
          return {
            conflict,
            resolution: 'AUTO',
            resolved: true,
            action: 'CHANGE_TOOL',
            message: `Found alternative tool for task ${task.task.id}.`
          };
        }
      }
    }

    return {
      conflict,
      resolution: 'AUTO',
      resolved: false,
      action: 'CHANGE_TOOL',
      message: 'Could not find alternative tools for conflicting tasks.'
    };
  }

  private async resolveTimeConflict(conflict: TimeConflict): Promise<ConflictResolution> {
    const tasks = conflict.conflictingTasks
      .map(taskId => this.queue.getTaskState(taskId))
      .filter((task): task is TaskNode => task !== undefined);

    // Sort tasks by priority, defaulting to 0 if priority is undefined
    const sortedTasks = tasks.sort((a, b) => this.getPriorityValue(b.task.priority) - this.getPriorityValue(a.task.priority));

    // Try to find alternative time windows
    for (let i = 1; i < sortedTasks.length; i++) {
      const task = sortedTasks[i];
      if (task) {
        const alternativeTime = await this.findAlternativeTimeWindow(
          task.task.id,
          conflict.startTime,
          conflict.endTime
        );

        if (alternativeTime) {
          return {
            conflict,
            resolution: 'AUTO',
            resolved: true,
            action: 'RESCHEDULE',
            message: `Found alternative time window for task ${task.task.id}.`
          };
        }
      }
    }

    return {
      conflict,
      resolution: 'AUTO',
      resolved: false,
      action: 'RESCHEDULE',
      message: 'Could not find alternative time windows for conflicting tasks.'
    };
  }

  private getAvailableResourceQuantity(resourceType: string): number {
    // Implementation should be provided based on your resource management system
    return 0;
  }

  private getTaskResourceRequirement(taskId: string, resourceType: string): number {
    // Implementation should be provided based on your task requirements system
    return 0;
  }

  private async findAlternativeLocation(
    taskId: string,
    originalPosition: { x: number; y: number; z: number }
  ): Promise<{ x: number; y: number; z: number } | null> {
    // Implementation should be provided based on your location management system
    return null;
  }

  private async findAlternativeTool(taskId: string, originalTool: string): Promise<string | null> {
    // Implementation should be provided based on your tool management system
    return null;
  }

  private async findAlternativeTimeWindow(
    taskId: string,
    startTime: number,
    endTime: number
  ): Promise<{ start: number; end: number } | null> {
    // Implementation should be provided based on your scheduling system
    return null;
  }
} 