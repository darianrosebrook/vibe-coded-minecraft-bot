import { DependencyGraph } from '../graph';
import { Task } from '@/types';
import { ValidationStatus, ExecutionState } from '@/types';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;
  let task1: Task;
  let task2: Task;
  let task3: Task;

  beforeEach(() => {
    graph = new DependencyGraph();
    task1 = {
      id: 'task-1',
      type: 'test',
      parameters: {},
      priority: 1,
      data: {}
    };
    task2 = {
      id: 'task-2',
      type: 'test',
      parameters: {},
      priority: 2,
      data: {}
    };
    task3 = {
      id: 'task-3',
      type: 'test',
      parameters: {},
      priority: 3,
      data: {}
    };
  });

  describe('node management', () => {
    it('should add a node', () => {
      const node = graph.addNode(task1);
      expect(graph.getNode(node.id)).toBeDefined();
      expect(graph.getNode(node.id)?.task).toBe(task1);
    });

    it('should remove a node', () => {
      const node = graph.addNode(task1);
      graph.removeNode(node.id);
      expect(graph.getNode(node.id)).toBeUndefined();
    });

    it('should clear all nodes', () => {
      graph.addNode(task1);
      graph.addNode(task2);
      graph.clear();
      expect(graph.getNode('task-1')).toBeUndefined();
      expect(graph.getNode('task-2')).toBeUndefined();
    });
  });

  describe('edge management', () => {
    it('should add an edge', () => {
      const node1 = graph.addNode(task1);
      const node2 = graph.addNode(task2);
      graph.addEdge(node1.id, node2.id);
      expect(graph.getDependencies(node2.id).has(node1.id)).toBe(true);
      expect(graph.getDependents(node1.id).has(node2.id)).toBe(true);
    });

    it('should remove an edge', () => {
      const node1 = graph.addNode(task1);
      const node2 = graph.addNode(task2);
      graph.addEdge(node1.id, node2.id);
      graph.removeEdge(node1.id, node2.id);
      expect(graph.getDependencies(node2.id).has(node1.id)).toBe(false);
      expect(graph.getDependents(node1.id).has(node2.id)).toBe(false);
    });

    it('should throw when adding edge to non-existent nodes', () => {
      expect(() => graph.addEdge('non-existent-1', 'non-existent-2')).toThrow();
    });
  });

  describe('cycle detection', () => {
    it('should detect cycles', () => {
      const node1 = graph.addNode(task1);
      const node2 = graph.addNode(task2);
      const node3 = graph.addNode(task3);

      graph.addEdge(node1.id, node2.id);
      graph.addEdge(node2.id, node3.id);
      graph.addEdge(node3.id, node1.id);

      expect(graph.hasCycle()).toBe(true);
    });

    it('should not detect cycles in acyclic graphs', () => {
      const node1 = graph.addNode(task1);
      const node2 = graph.addNode(task2);
      const node3 = graph.addNode(task3);

      graph.addEdge(node1.id, node2.id);
      graph.addEdge(node2.id, node3.id);

      expect(graph.hasCycle()).toBe(false);
    });
  });

  describe('topological sorting', () => {
    it('should return valid topological order', () => {
      const node1 = graph.addNode(task1);
      const node2 = graph.addNode(task2);
      const node3 = graph.addNode(task3);

      graph.addEdge(node1.id, node2.id);
      graph.addEdge(node2.id, node3.id);

      const order = graph.getTopologicalOrder();
      expect(order).toContain(node1.id);
      expect(order).toContain(node2.id);
      expect(order).toContain(node3.id);
      expect(order.indexOf(node1.id)).toBeLessThan(order.indexOf(node2.id));
      expect(order.indexOf(node2.id)).toBeLessThan(order.indexOf(node3.id));
    });

    it('should throw when graph has cycles', () => {
      const node1 = graph.addNode(task1);
      const node2 = graph.addNode(task2);

      graph.addEdge(node1.id, node2.id);
      graph.addEdge(node2.id, node1.id);

      expect(() => graph.getTopologicalOrder()).toThrow();
    });
  });

  describe('ready nodes', () => {
    it('should return ready nodes', () => {
      const node1 = graph.addNode(task1);
      const node2 = graph.addNode(task2);

      node1.setValidationStatus(ValidationStatus.VALID);
      node1.setExecutionState(ExecutionState.PENDING);

      node2.setValidationStatus(ValidationStatus.VALID);
      node2.setExecutionState(ExecutionState.PENDING);

      const readyNodes = graph.getReadyNodes();
      expect(readyNodes).toContain(node1);
      expect(readyNodes).toContain(node2);
    });

    it('should not return nodes with dependencies', () => {
      const node1 = graph.addNode(task1);
      const node2 = graph.addNode(task2);

      graph.addEdge(node1.id, node2.id);

      node1.setValidationStatus(ValidationStatus.VALID);
      node1.setExecutionState(ExecutionState.PENDING);

      node2.setValidationStatus(ValidationStatus.VALID);
      node2.setExecutionState(ExecutionState.PENDING);

      const readyNodes = graph.getReadyNodes();
      expect(readyNodes).toContain(node1);
      expect(readyNodes).not.toContain(node2);
    });
  });
}); 