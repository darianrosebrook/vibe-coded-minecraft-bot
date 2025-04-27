import { Task } from '../types';

export enum ValidationStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID',
  SKIPPED = 'SKIPPED'
}

export enum ExecutionState {
  PENDING = 'PENDING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface TaskNode {
  id: string;
  task: Task;
  dependencies: Set<string>;
  dependents: Set<string>;
  validationStatus: ValidationStatus;
  executionState: ExecutionState;
  metadata?: Record<string, any>;

  // Methods
  addDependency(nodeId: string): void;
  removeDependency(nodeId: string): void;
  addDependent(nodeId: string): void;
  removeDependent(nodeId: string): void;
  setValidationStatus(status: ValidationStatus): void;
  setExecutionState(state: ExecutionState): void;
  setMetadata(key: string, value: any): void;
  getMetadata(key: string): any;
  isReady(): boolean;
  isCompleted(): boolean;
  isFailed(): boolean;
  isCancelled(): boolean;
  isRunning(): boolean;
  hasDependencies(): boolean;
  hasDependents(): boolean;
}

export interface DependencyGraph {
  nodes: Map<string, TaskNode>;
  edges: Map<string, Set<string>>;

  // Methods
  addNode(task: Task, id?: string): TaskNode;
  removeNode(nodeId: string): void;
  addEdge(fromId: string, toId: string): void;
  removeEdge(fromId: string, toId: string): void;
  hasCycle(): boolean;
  getTopologicalOrder(): string[];
  getReadyNodes(): TaskNode[];
  getNode(nodeId: string): TaskNode | undefined;
  getDependencies(nodeId: string): Set<string>;
  getDependents(nodeId: string): Set<string>;
  clear(): void;
}

export interface TaskQueue {
  queue: PriorityQueue<TaskNode>;
  runningTasks: Set<string>;
  completedTasks: Set<string>;
  failedTasks: Set<string>;
}

export interface PriorityQueue<T> {
  push(item: T, priority: number): void;
  pop(): T | undefined;
  peek(): T | undefined;
  size(): number;
  isEmpty(): boolean;
  clear(): void;
} 