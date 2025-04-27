import { Task } from '../types/task';
import { DependencyGraph } from './dependencyGraph';

export enum TaskState {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export interface TaskNode {
  task: Task;
  state: TaskState;
  dependencies: Set<string>;
  dependents: Set<string>;
  retryCount: number;
  lastError?: string;
}

export class TaskQueue {
  private graph: DependencyGraph;
  private nodes: Map<string, TaskNode>;
  private maxRetries: number;

  constructor(maxRetries: number = 3) {
    this.graph = new DependencyGraph();
    this.nodes = new Map();
    this.maxRetries = maxRetries;
  }

  addTask(task: Task): void {
    if (this.nodes.has(task.id)) {
      throw new Error(`Task ${task.id} already exists in the queue`);
    }

    const node: TaskNode = {
      task,
      state: TaskState.PENDING,
      dependencies: new Set(task.dependencies || []),
      dependents: new Set(),
      retryCount: 0
    };

    this.nodes.set(task.id, node);
    this.graph.addNode(task.id);

    for (const depId of node.dependencies) {
      this.graph.addEdge(depId, task.id);
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.add(task.id);
      }
    }
  }

  removeTask(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) {
      return;
    }

    // Remove from dependents' dependencies
    for (const dependentId of node.dependents) {
      const dependent = this.nodes.get(dependentId);
      if (dependent) {
        dependent.dependencies.delete(taskId);
      }
    }

    // Remove from dependencies' dependents
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.delete(taskId);
      }
    }

    this.nodes.delete(taskId);
    this.graph.removeNode(taskId);
  }

  getTaskState(taskId: string): TaskNode | undefined {
    return this.nodes.get(taskId);
  }

  updateTaskState(taskId: string, state: TaskState, error?: string): void {
    const node = this.nodes.get(taskId);
    if (!node) {
      throw new Error(`Task ${taskId} not found in queue`);
    }

    node.state = state;
    if (error) {
      node.lastError = error;
    }

    if (state === TaskState.FAILED && node.retryCount < this.maxRetries) {
      node.state = TaskState.RETRYING;
      node.retryCount++;
    }
  }

  getNextTask(): TaskNode | undefined {
    const readyNodes = this.graph.getReadyNodes();
    for (const taskId of readyNodes) {
      const node = this.nodes.get(taskId);
      if (node && node.state === TaskState.PENDING) {
        return node;
      }
    }
    return undefined;
  }

  isComplete(): boolean {
    return this.nodes.size === 0 || Array.from(this.nodes.values()).every(
      node => node.state === TaskState.COMPLETED || node.state === TaskState.FAILED
    );
  }

  getFailedTasks(): TaskNode[] {
    return Array.from(this.nodes.values()).filter(node => node.state === TaskState.FAILED);
  }

  getRetryingTasks(): TaskNode[] {
    return Array.from(this.nodes.values()).filter(node => node.state === TaskState.RETRYING);
  }

  getRunningTasks(): Task[] {
    return Array.from(this.nodes.values())
      .filter(node => node.state === TaskState.RUNNING)
      .map(node => node.task);
  }

  getReadyTasks(): Task[] {
    const readyNodeIds = this.graph.getReadyNodes();
    return readyNodeIds
      .map((id: string) => this.nodes.get(id))
      .filter((node: TaskNode | undefined): node is TaskNode => 
        node !== undefined && node.state === TaskState.PENDING
      )
      .map((node: TaskNode) => node.task);
  }

  clear(): void {
    this.nodes.clear();
    this.graph.clear();
  }
} 