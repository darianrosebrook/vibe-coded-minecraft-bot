import { TaskQueue, TaskState, TaskNode } from './queue';
import { Task } from '@/types/task';
import { TaskValidator } from '../../utils/taskValidator';

export interface SchedulerConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class TaskScheduler {
  private queue: TaskQueue;
  private validator: TaskValidator;
  private config: SchedulerConfig;
  private runningTasks: Map<string, NodeJS.Timeout> = new Map();
  private taskHandlers: Map<string, (task: Task) => Promise<void>> = new Map();

  constructor(
    queue: TaskQueue,
    validator: TaskValidator,
    config: Partial<SchedulerConfig> = {}
  ) {
    this.queue = queue;
    this.validator = validator;
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      taskTimeout: config.taskTimeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000
    };
  }

  registerTaskHandler(taskType: string, handler: (task: Task) => Promise<void>): void {
    this.taskHandlers.set(taskType, handler);
  }

  async start(): Promise<void> {
    while (!this.queue.isComplete()) {
      await this.processNextBatch();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async processNextBatch(): Promise<void> {
    const runningCount = this.runningTasks.size;
    const availableSlots = this.config.maxConcurrentTasks - runningCount;

    if (availableSlots <= 0) {
      return;
    }

    for (let i = 0; i < availableSlots; i++) {
      const nextTask = this.queue.getNextTask();
      if (!nextTask) {
        break;
      }

      await this.executeTask(nextTask.task);
    }
  }

  private async executeTask(task: Task): Promise<void> {
    const handler = this.taskHandlers.get(task.type);
    if (!handler) {
      throw new Error(`No handler registered for task type: ${task.type}`);
    }

    this.queue.updateTaskState(task.id, TaskState.RUNNING);

    const timeout = setTimeout(() => {
      this.handleTaskTimeout(task);
    }, this.config.taskTimeout);

    this.runningTasks.set(task.id, timeout);

    try {
      await handler(task);
      this.queue.updateTaskState(task.id, TaskState.COMPLETED);
    } catch (error) {
      await this.handleTaskRetry(task, error);
    } finally {
      clearTimeout(timeout);
      this.runningTasks.delete(task.id);
    }
  }

  private async handleTaskRetry(task: Task, error: any): Promise<void> {
    const node = this.queue.getTaskState(task.id);
    if (!node) {
      return;
    }

    if (node.retryCount >= this.config.retryAttempts) {
      this.queue.updateTaskState(task.id, TaskState.FAILED, error.message);
      return;
    }

    this.queue.updateTaskState(task.id, TaskState.RETRYING, error.message);
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
    this.queue.updateTaskState(task.id, TaskState.PENDING);
  }

  private handleTaskTimeout(task: Task): void {
    this.queue.updateTaskState(task.id, TaskState.FAILED, 'Task execution timed out');
    const timeout = this.runningTasks.get(task.id);
    if (timeout) {
      clearTimeout(timeout);
      this.runningTasks.delete(task.id);
    }
  }

  stop(): void {
    for (const [taskId, timeout] of this.runningTasks) {
      clearTimeout(timeout);
      this.queue.updateTaskState(taskId, TaskState.FAILED, 'Scheduler stopped');
    }
    this.runningTasks.clear();
  }

  getRunningTaskCount(): number {
    return this.runningTasks.size;
  }

  getTaskProgress(taskId: string): number {
    const node = this.queue.getTaskState(taskId); 
    return node?.task?.progress?.current || 0;
  }
} 