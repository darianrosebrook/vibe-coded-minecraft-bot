import { Task } from '@/types';
import { TaskNode as TaskNodeInterface, ValidationStatus, ExecutionState } from '@/types';

export class TaskNode implements TaskNodeInterface {
  public readonly id: string;
  public readonly task: Task;
  public readonly dependencies: Set<string>;
  public readonly dependents: Set<string>;
  public validationStatus: ValidationStatus;
  public executionState: ExecutionState;
  public metadata: Record<string, any>;

  constructor(task: Task, id?: string) {
    this.id = id || crypto.randomUUID();
    this.task = task;
    this.dependencies = new Set();
    this.dependents = new Set();
    this.validationStatus = ValidationStatus.PENDING;
    this.executionState = ExecutionState.PENDING;
    this.metadata = {};
  }

  public addDependency(nodeId: string): void {
    this.dependencies.add(nodeId);
  }

  public removeDependency(nodeId: string): void {
    this.dependencies.delete(nodeId);
  }

  public addDependent(nodeId: string): void {
    this.dependents.add(nodeId);
  }

  public removeDependent(nodeId: string): void {
    this.dependents.delete(nodeId);
  }

  public setValidationStatus(status: ValidationStatus): void {
    this.validationStatus = status;
  }

  public setExecutionState(state: ExecutionState): void {
    this.executionState = state;
  }

  public setMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  public getMetadata(key: string): any {
    return this.metadata[key];
  }

  public isReady(): boolean {
    return this.validationStatus === ValidationStatus.VALID &&
           this.executionState === ExecutionState.PENDING;
  }

  public isCompleted(): boolean {
    return this.executionState === ExecutionState.COMPLETED;
  }

  public isFailed(): boolean {
    return this.executionState === ExecutionState.FAILED;
  }

  public isCancelled(): boolean {
    return this.executionState === ExecutionState.CANCELLED;
  }

  public isRunning(): boolean {
    return this.executionState === ExecutionState.RUNNING;
  }

  public hasDependencies(): boolean {
    return this.dependencies.size > 0;
  }

  public hasDependents(): boolean {
    return this.dependents.size > 0;
  }
} 