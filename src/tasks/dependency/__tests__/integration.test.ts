import { DependencyGraph } from '../graph';
import { Task } from '../../types';
import { ValidationStatus, ExecutionState } from '../types';

describe('Task Dependency Integration', () => {
  let graph: DependencyGraph;
  let miningTask: Task;
  let smeltingTask: Task;
  let craftingTask: Task;

  beforeEach(() => {
    graph = new DependencyGraph();
    miningTask = {
      id: 'mining-1',
      type: 'mining',
      parameters: {
        block: 'iron_ore',
        quantity: 32
      },
      priority: 1,
      requirements: {
        tools: [{
          type: 'pickaxe',
          material: 'iron',
          required: true
        }]
      },
      data: {}
    };

    smeltingTask = {
      id: 'smelting-1',
      type: 'smelting',
      parameters: {
        item: 'iron_ore',
        quantity: 32
      },
      priority: 2,
      requirements: {
        items: [{
          type: 'iron_ore',
          quantity: 32,
          required: true
        }]
      },
      data: {}
    };

    craftingTask = {
      id: 'crafting-1',
      type: 'crafting',
      parameters: {
        item: 'iron_pickaxe',
        quantity: 1
      },
      priority: 3,
      requirements: {
        items: [{
          type: 'iron_ingot',
          quantity: 3,
          required: true
        }, {
          type: 'stick',
          quantity: 2,
          required: true
        }]
      },
      data: {}
    };
  });

  describe('task execution flow', () => {
    it('should handle a complete task chain', () => {
      // Add tasks to graph
      const miningNode = graph.addNode(miningTask);
      const smeltingNode = graph.addNode(smeltingTask);
      const craftingNode = graph.addNode(craftingTask);

      // Set up dependencies
      graph.addEdge(miningNode.id, smeltingNode.id);
      graph.addEdge(smeltingNode.id, craftingNode.id);

      // Validate mining task
      miningNode.setValidationStatus(ValidationStatus.VALID);
      miningNode.setExecutionState(ExecutionState.PENDING);

      // Get ready nodes (should only be mining task)
      let readyNodes = graph.getReadyNodes();
      expect(readyNodes).toContain(miningNode);
      expect(readyNodes).not.toContain(smeltingNode);
      expect(readyNodes).not.toContain(craftingNode);

      // Complete mining task
      miningNode.setExecutionState(ExecutionState.COMPLETED);

      // Validate smelting task
      smeltingNode.setValidationStatus(ValidationStatus.VALID);
      smeltingNode.setExecutionState(ExecutionState.PENDING);

      // Get ready nodes (should only be smelting task)
      readyNodes = graph.getReadyNodes();
      expect(readyNodes).not.toContain(miningNode);
      expect(readyNodes).toContain(smeltingNode);
      expect(readyNodes).not.toContain(craftingNode);

      // Complete smelting task
      smeltingNode.setExecutionState(ExecutionState.COMPLETED);

      // Validate crafting task
      craftingNode.setValidationStatus(ValidationStatus.VALID);
      craftingNode.setExecutionState(ExecutionState.PENDING);

      // Get ready nodes (should only be crafting task)
      readyNodes = graph.getReadyNodes();
      expect(readyNodes).not.toContain(miningNode);
      expect(readyNodes).not.toContain(smeltingNode);
      expect(readyNodes).toContain(craftingNode);
    });

    it('should handle task failure and retry', () => {
      const miningNode = graph.addNode(miningTask);
      const smeltingNode = graph.addNode(smeltingTask);

      graph.addEdge(miningNode.id, smeltingNode.id);

      // Set up mining task
      miningNode.setValidationStatus(ValidationStatus.VALID);
      miningNode.setExecutionState(ExecutionState.PENDING);

      // Fail mining task
      miningNode.setExecutionState(ExecutionState.FAILED);

      // Retry mining task
      miningNode.setExecutionState(ExecutionState.PENDING);

      // Complete mining task
      miningNode.setExecutionState(ExecutionState.COMPLETED);

      // Set up smelting task
      smeltingNode.setValidationStatus(ValidationStatus.VALID);
      smeltingNode.setExecutionState(ExecutionState.PENDING);

      // Verify smelting task is ready
      const readyNodes = graph.getReadyNodes();
      expect(readyNodes).toContain(smeltingNode);
    });

    it('should handle task cancellation', () => {
      const miningNode = graph.addNode(miningTask);
      const smeltingNode = graph.addNode(smeltingTask);

      graph.addEdge(miningNode.id, smeltingNode.id);

      // Set up mining task
      miningNode.setValidationStatus(ValidationStatus.VALID);
      miningNode.setExecutionState(ExecutionState.PENDING);

      // Cancel mining task
      miningNode.setExecutionState(ExecutionState.CANCELLED);

      // Set up smelting task
      smeltingNode.setValidationStatus(ValidationStatus.VALID);
      smeltingNode.setExecutionState(ExecutionState.PENDING);

      // Verify smelting task is not ready (due to cancelled dependency)
      const readyNodes = graph.getReadyNodes();
      expect(readyNodes).not.toContain(smeltingNode);
    });
  });

  describe('task validation', () => {
    it('should handle invalid tasks', () => {
      const miningNode = graph.addNode(miningTask);
      const smeltingNode = graph.addNode(smeltingTask);

      graph.addEdge(miningNode.id, smeltingNode.id);

      // Set mining task as invalid
      miningNode.setValidationStatus(ValidationStatus.INVALID);
      miningNode.setExecutionState(ExecutionState.PENDING);

      // Set up smelting task
      smeltingNode.setValidationStatus(ValidationStatus.VALID);
      smeltingNode.setExecutionState(ExecutionState.PENDING);

      // Verify neither task is ready
      const readyNodes = graph.getReadyNodes();
      expect(readyNodes).not.toContain(miningNode);
      expect(readyNodes).not.toContain(smeltingNode);
    });

    it('should handle skipped tasks', () => {
      const miningNode = graph.addNode(miningTask);
      const smeltingNode = graph.addNode(smeltingTask);

      graph.addEdge(miningNode.id, smeltingNode.id);

      // Skip mining task
      miningNode.setValidationStatus(ValidationStatus.SKIPPED);
      miningNode.setExecutionState(ExecutionState.COMPLETED);

      // Set up smelting task
      smeltingNode.setValidationStatus(ValidationStatus.VALID);
      smeltingNode.setExecutionState(ExecutionState.PENDING);

      // Verify smelting task is ready (dependency was skipped)
      const readyNodes = graph.getReadyNodes();
      expect(readyNodes).toContain(smeltingNode);
    });
  });
}); 