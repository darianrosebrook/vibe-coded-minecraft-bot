import { ValidationRuleEngine, TaskContext } from '../validation_rule_engine';
import { Task, TaskType, TaskStatus, TaskParameters, TaskPriority, MiningTaskParameters, CraftingTaskParameters, NavigationTaskParameters } from '@/types/task';

describe('ValidationRuleEngine', () => {
  let engine: ValidationRuleEngine;
  let mockContext: TaskContext;

  beforeEach(() => {
    engine = new ValidationRuleEngine();
    mockContext = {
      bot: {} as any,
      worldState: {
        inventory: {
          hasTool: jest.fn().mockReturnValue(true),
          hasMaterials: jest.fn().mockReturnValue(true)
        }
      }
    };
  });

  describe('validateTask', () => {
    it('should validate mining task with required tool', async () => {
      const task: Task = {
        type: TaskType.MINING,
        parameters: {
          block: 'stone',
          quantity: 10,
          tool: 'pickaxe'
        } as MiningTaskParameters,
        status: TaskStatus.PENDING,
        id: '1',
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await engine.validateTask(task, mockContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect((task.parameters as MiningTaskParameters).tool).toBe('pickaxe');
    });

    it('should fail mining task when tool is not available', async () => {
      const task: Task = {
        type: TaskType.MINING,
        parameters: {
          block: 'stone',
          quantity: 10,
          tool: 'pickaxe'
        } as MiningTaskParameters,
        status: TaskStatus.PENDING,
        id: '1',
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (mockContext.worldState.inventory.hasTool as jest.Mock).mockReturnValue(false);
      const result = await engine.validateTask(task, mockContext);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('A pickaxe is required for mining tasks');
    });

    it('should validate crafting task with materials', async () => {
      const task: Task = {
        type: TaskType.CRAFTING,
        parameters: {
          recipe: 'planks',
          materials: ['planks', 'sticks']
        } as unknown as TaskParameters,
        status: TaskStatus.PENDING,
        id: '2',
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await engine.validateTask(task, mockContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect((task.parameters as unknown as CraftingTaskParameters).materials).toEqual(['planks', 'sticks']);
    });

    it('should fail crafting task when materials are not available', async () => {
      const task: Task = {
        type: TaskType.CRAFTING,
        parameters: {
          recipe: 'planks',
          materials: ['planks', 'sticks']
        } as unknown as TaskParameters,
        status: TaskStatus.PENDING,
        id: '2',
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      (mockContext.worldState.inventory.hasMaterials as jest.Mock).mockReturnValue(false);
      const result = await engine.validateTask(task, mockContext);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Required materials are not available');
    });

    it('should validate navigation task with valid coordinates', async () => {
      const task: Task = {
        type: TaskType.NAVIGATION,
        parameters: {
          location: { x: 10.5, y: 64.2, z: -20.8 }
        } as NavigationTaskParameters,
        status: TaskStatus.PENDING,
        id: '3',
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContext.currentTask = task;
      const result = await engine.validateTask(task, mockContext);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect((task.parameters as NavigationTaskParameters).location).toEqual({
        x: 10,
        y: 64,
        z: -20
      });
    });

    it('should fail navigation task with invalid coordinates', async () => {
      const task: Task = {
        type: TaskType.NAVIGATION,
        parameters: {
          location: { x: 10.5, y: 64.2, z: -20.8 }
        } as unknown as TaskParameters,
        status: TaskStatus.PENDING,
        id: '3',
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockContext.currentTask = task;
      const result = await engine.validateTask(task, mockContext);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Invalid destination coordinates');
    });
  });

  describe('rule priorities', () => {
    it('should maintain rule priorities', () => {
      const priorities = engine.getRulePriorities();
      expect(priorities.get('required_tool')).toBe(100);
      expect(priorities.get('material_availability')).toBe(90);
      expect(priorities.get('valid_destination')).toBe(80);
    });
  });
}); 