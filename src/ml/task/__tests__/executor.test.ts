import { MLTaskExecutor } from '../executor';
import { MLTaskOptimizer } from '../optimizer';
import { MLStateManager } from '../../state/manager';
import { Task, TaskPriority, TaskStatus, TaskType, TaskParameters, MiningTaskParameters, GatheringTaskParameters, NavigationTaskParameters, InventoryTaskParameters } from '../../../types/task';
import { GameState } from '../../../llm/context/manager';
import { TaskHistory } from '../../state/types';
import { Vec3 } from 'vec3';

describe('MLTaskExecutor', () => {
  let executor: MLTaskExecutor;
  let optimizer: MLTaskOptimizer;
  let stateManager: MLStateManager;
  let mockGameState: GameState;

  beforeEach(() => {
    // Create mock instances
    optimizer = {
      optimizeTask: jest.fn().mockResolvedValue({
        priority: TaskPriority.HIGH,
        executionPlan: ['gather:wood:10', 'move:forest', 'execute:build'],
        estimatedDuration: 60000,
        confidence: 0.9
      })
    } as unknown as MLTaskOptimizer;

    stateManager = {
      getCurrentState: jest.fn().mockResolvedValue(mockGameState)
    } as unknown as MLStateManager;

    mockGameState = {
      position: new Vec3(0, 0, 0),
      health: 20,
      isNight: false,
      equipment: ['wooden_sword'],
      inventory: {
        items: [],
        totalSlots: 36,
        usedSlots: 0
      }
    };

    executor = new MLTaskExecutor(optimizer, stateManager);
  });

  describe('executeTask', () => {
    it('should successfully execute a mining task with optimization', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.MINING,
        parameters: {
          block: 'stone',
          quantity: 64,
          maxDistance: 32,
          usePathfinding: true
        } as MiningTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await executor.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.task.priority).toBe(TaskPriority.HIGH);
      expect(result.task.metadata?.executionPlan).toEqual([
        'gather:wood:10',
        'move:forest',
        'execute:build'
      ]);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle task execution failure', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.MINING,
        parameters: {
          block: 'stone',
          quantity: 64,
          maxDistance: 32,
          usePathfinding: true
        } as MiningTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock optimizer to throw an error
      (optimizer.optimizeTask as jest.Mock).mockRejectedValue(new Error('Optimization failed'));

      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Optimization failed');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle task with missing parameters', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.MINING,
        parameters: {
          block: 'stone'
        } as MiningTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await executor.executeTask(task);
      expect(result.success).toBe(true);
      expect(result.task.parameters).toHaveProperty('block', 'stone');
    });

    it('should handle task with invalid parameters', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.MINING,
        parameters: {
          block: 'invalid_block',
          quantity: -1,
          maxDistance: 0
        } as MiningTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await executor.executeTask(task);
      expect(result.success).toBe(true); // Should still execute but with validation
    });
  });

  describe('task history', () => {
    it('should record task execution history', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.MINING,
        parameters: {
          block: 'stone',
          quantity: 64,
          maxDistance: 32,
          usePathfinding: true
        } as MiningTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await executor.executeTask(task);
      const history = executor.getTaskHistory(task.id);

      expect(history).toBeDefined();
      expect(history?.taskId).toBe(task.id);
      expect(history?.taskType).toBe(task.type);
      expect(history?.success).toBe(true);
      expect(history?.executionTime).toBeGreaterThan(0);
    });

    it('should handle concurrent task execution', async () => {
      const task1: Task = {
        id: 'test-task-1',
        type: TaskType.MINING,
        parameters: {
          block: 'stone',
          quantity: 64,
          maxDistance: 32,
          usePathfinding: true
        } as MiningTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const task2: Task = {
        id: 'test-task-2',
        type: TaskType.GATHERING,
        parameters: {
          itemType: 'wood',
          quantity: 10,
          maxDistance: 32,
          usePathfinding: true
        } as GatheringTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Execute tasks concurrently
      const [result1, result2] = await Promise.all([
        executor.executeTask(task1),
        executor.executeTask(task2)
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(executor.getAllTaskHistory().length).toBe(2);
    });
  });

  describe('execution plan', () => {
    it('should execute gathering task', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.GATHERING,
        parameters: {
          itemType: 'wood',
          quantity: 10,
          maxDistance: 32,
          usePathfinding: true
        } as GatheringTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (optimizer.optimizeTask as jest.Mock).mockResolvedValue({
        priority: TaskPriority.HIGH,
        executionPlan: ['gather:wood:10'],
        estimatedDuration: 30000,
        confidence: 0.9
      });

      const result = await executor.executeTask(task);
      expect(result.success).toBe(true);
    });

    it('should execute navigation task', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.NAVIGATION,
        parameters: {
          location: {
            x: 100,
            y: 64,
            z: -200
          },
          usePathfinding: true,
          maxDistance: 32
        } as NavigationTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (optimizer.optimizeTask as jest.Mock).mockResolvedValue({
        priority: TaskPriority.HIGH,
        executionPlan: ['move:forest'],
        estimatedDuration: 15000,
        confidence: 0.9
      });

      const result = await executor.executeTask(task);
      expect(result.success).toBe(true);
    });

    it('should execute inventory task', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.INVENTORY,
        parameters: {
          itemType: 'wooden_sword',
          quantity: 1,
          action: 'check'
        } as InventoryTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (optimizer.optimizeTask as jest.Mock).mockResolvedValue({
        priority: TaskPriority.HIGH,
        executionPlan: ['equip:wooden_sword'],
        estimatedDuration: 5000,
        confidence: 0.9
      });

      const result = await executor.executeTask(task);
      expect(result.success).toBe(true);
    });

    it('should handle task with empty execution plan', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.MINING,
        parameters: {
          block: 'stone',
          quantity: 64,
          maxDistance: 32,
          usePathfinding: true
        } as MiningTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (optimizer.optimizeTask as jest.Mock).mockResolvedValue({
        priority: TaskPriority.HIGH,
        executionPlan: [],
        estimatedDuration: 0,
        confidence: 0.9
      });

      const result = await executor.executeTask(task);
      expect(result.success).toBe(true);
      expect(result.task.metadata?.executionPlan).toEqual([]);
    });

    it('should handle task with low confidence optimization', async () => {
      const task: Task = {
        id: 'test-task',
        type: TaskType.MINING,
        parameters: {
          block: 'stone',
          quantity: 64,
          maxDistance: 32,
          usePathfinding: true
        } as MiningTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (optimizer.optimizeTask as jest.Mock).mockResolvedValue({
        priority: TaskPriority.HIGH,
        executionPlan: ['gather:wood:10', 'move:forest', 'execute:build'],
        estimatedDuration: 60000,
        confidence: 0.3 // Low confidence
      });

      const result = await executor.executeTask(task);
      expect(result.success).toBe(true);
      expect(result.task.metadata?.confidence).toBe(0.3);
    });
  });
}); 