import { TaskNode } from '../node';
import { Task } from '../../types';
import { ValidationStatus, ExecutionState } from '../types';

describe('TaskNode', () => {
  let task: Task;
  let node: TaskNode;

  beforeEach(() => {
    task = {
      id: 'test-task',
      type: 'test',
      parameters: {},
      priority: 1,
      data: {}
    };
    node = new TaskNode(task);
  });

  describe('constructor', () => {
    it('should create a node with the given task', () => {
      expect(node.task).toBe(task);
    });

    it('should generate a UUID if no id is provided', () => {
      expect(node.id).toBeDefined();
      expect(node.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should use the provided id if given', () => {
      const customId = 'custom-id';
      const customNode = new TaskNode(task, customId);
      expect(customNode.id).toBe(customId);
    });

    it('should initialize with empty dependencies and dependents', () => {
      expect(node.dependencies.size).toBe(0);
      expect(node.dependents.size).toBe(0);
    });

    it('should initialize with PENDING validation status', () => {
      expect(node.validationStatus).toBe(ValidationStatus.PENDING);
    });

    it('should initialize with PENDING execution state', () => {
      expect(node.executionState).toBe(ExecutionState.PENDING);
    });
  });

  describe('dependency management', () => {
    it('should add a dependency', () => {
      const dependencyId = 'dependency-1';
      node.addDependency(dependencyId);
      expect(node.dependencies.has(dependencyId)).toBe(true);
    });

    it('should remove a dependency', () => {
      const dependencyId = 'dependency-1';
      node.addDependency(dependencyId);
      node.removeDependency(dependencyId);
      expect(node.dependencies.has(dependencyId)).toBe(false);
    });

    it('should add a dependent', () => {
      const dependentId = 'dependent-1';
      node.addDependent(dependentId);
      expect(node.dependents.has(dependentId)).toBe(true);
    });

    it('should remove a dependent', () => {
      const dependentId = 'dependent-1';
      node.addDependent(dependentId);
      node.removeDependent(dependentId);
      expect(node.dependents.has(dependentId)).toBe(false);
    });
  });

  describe('state management', () => {
    it('should set validation status', () => {
      node.setValidationStatus(ValidationStatus.VALID);
      expect(node.validationStatus).toBe(ValidationStatus.VALID);
    });

    it('should set execution state', () => {
      node.setExecutionState(ExecutionState.RUNNING);
      expect(node.executionState).toBe(ExecutionState.RUNNING);
    });
  });

  describe('metadata management', () => {
    it('should set metadata', () => {
      node.setMetadata('test', 'value');
      expect(node.getMetadata('test')).toBe('value');
    });

    it('should return undefined for non-existent metadata', () => {
      expect(node.getMetadata('non-existent')).toBeUndefined();
    });
  });

  describe('state checks', () => {
    it('should correctly identify ready state', () => {
      node.setValidationStatus(ValidationStatus.VALID);
      node.setExecutionState(ExecutionState.PENDING);
      expect(node.isReady()).toBe(true);
    });

    it('should correctly identify completed state', () => {
      node.setExecutionState(ExecutionState.COMPLETED);
      expect(node.isCompleted()).toBe(true);
    });

    it('should correctly identify failed state', () => {
      node.setExecutionState(ExecutionState.FAILED);
      expect(node.isFailed()).toBe(true);
    });

    it('should correctly identify cancelled state', () => {
      node.setExecutionState(ExecutionState.CANCELLED);
      expect(node.isCancelled()).toBe(true);
    });

    it('should correctly identify running state', () => {
      node.setExecutionState(ExecutionState.RUNNING);
      expect(node.isRunning()).toBe(true);
    });

    it('should correctly check for dependencies', () => {
      expect(node.hasDependencies()).toBe(false);
      node.addDependency('dependency-1');
      expect(node.hasDependencies()).toBe(true);
    });

    it('should correctly check for dependents', () => {
      expect(node.hasDependents()).toBe(false);
      node.addDependent('dependent-1');
      expect(node.hasDependents()).toBe(true);
    });
  });
}); 