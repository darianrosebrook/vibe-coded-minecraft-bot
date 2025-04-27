import { ValidationRuleEngine } from '../validation_rule_engine';
import { Task, TaskType } from '../../../types/task';
import { TaskContext } from '../../types';

describe('ValidationRuleEngine', () => {
  let engine: ValidationRuleEngine;
  let mockContext: TaskContext;

  beforeEach(() => {
    engine = new ValidationRuleEngine();
    mockContext = {
      inventory: {
        hasTool: jest.fn().mockReturnValue(true),
        hasMaterials: jest.fn().mockReturnValue(true)
      },
      task: undefined
    } as any;
  });

  describe('validateTask', () => {
    it('should validate mining task with required tool', async () => {
      const task: Task = {
        type: 'mining',
        parameters: {},
        status: 'pending'
      };

      const result = await engine.validateTask(task, mockContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(task.parameters.tool).toBe('pickaxe');
    });

    it('should fail mining task when tool is not available', async () => {
      const task: Task = {
        type: 'mining',
        parameters: {},
        status: 'pending'
      };

      (mockContext.inventory.hasTool as jest.Mock).mockReturnValue(false);
      const result = await engine.validateTask(task, mockContext);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('A pickaxe is required for mining tasks');
    });

    it('should validate crafting task with materials', async () => {
      const task: Task = {
        type: 'crafting',
        parameters: {},
        status: 'pending'
      };

      const result = await engine.validateTask(task, mockContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(task.parameters.materials).toEqual(['planks', 'sticks']);
    });

    it('should fail crafting task when materials are not available', async () => {
      const task: Task = {
        type: 'crafting',
        parameters: {},
        status: 'pending'
      };

      (mockContext.inventory.hasMaterials as jest.Mock).mockReturnValue(false);
      const result = await engine.validateTask(task, mockContext);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Required materials are not available');
    });

    it('should validate navigation task with valid coordinates', async () => {
      const task: Task = {
        type: 'navigation',
        parameters: {
          destination: { x: 10.5, y: 64.2, z: -20.8 }
        },
        status: 'pending'
      };

      mockContext.task = task;
      const result = await engine.validateTask(task, mockContext);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(task.parameters.destination).toEqual({
        x: 10,
        y: 64,
        z: -20
      });
    });

    it('should fail navigation task with invalid coordinates', async () => {
      const task: Task = {
        type: 'navigation',
        parameters: {
          destination: { x: 'invalid', y: 64, z: -20 }
        },
        status: 'pending'
      };

      mockContext.task = task;
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