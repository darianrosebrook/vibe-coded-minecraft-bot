import { TaskValidator } from '../validator';
import {
  InventoryRequirementRule,
  ToolRequirementRule,
  LocationRequirementRule,
  BiomeRequirementRule,
  TimeRequirementRule
} from '../rules';
import { Task } from '@/types';

describe('TaskValidator', () => {
  let validator: TaskValidator;
  let testTask: Task;
  let testContext: any;

  beforeEach(() => {
    validator = new TaskValidator();
    testTask = {
      id: 'test-task',
      type: 'test',
      data: {},
      parameters: {},
      priority: 1,
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    testContext = {
      inventory: {
        items: [
          { type: 'diamond_pickaxe', quantity: 1 },
          { type: 'diamond', quantity: 5 },
          { type: 'stone', quantity: 64 }
        ]
      },
      position: { x: 0, y: 0, z: 0 },
      biome: 'plains',
      time: 6000
    };
  });

  describe('InventoryRequirementRule', () => {
    it('should validate when all required items are present', async () => {
      const rule = new InventoryRequirementRule([
        { type: 'diamond', quantity: 3 },
        { type: 'stone', quantity: 32 }
      ]);
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required items are missing', async () => {
      const rule = new InventoryRequirementRule([
        { type: 'diamond', quantity: 10 },
        { type: 'gold', quantity: 1 }
      ]);
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required item: diamond (10 needed)');
      expect(result.errors).toContain('Missing required item: gold (1 needed)');
    });
  });

  describe('ToolRequirementRule', () => {
    it('should validate when required tool is present', async () => {
      const rule = new ToolRequirementRule('diamond_pickaxe');
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required tool is missing', async () => {
      const rule = new ToolRequirementRule('netherite_pickaxe');
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required tool: netherite_pickaxe');
    });
  });

  describe('LocationRequirementRule', () => {
    it('should validate when within tolerance', async () => {
      const rule = new LocationRequirementRule({ x: 1, y: 1, z: 1 }, 2);
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(false);
    });

    it('should fail when outside tolerance', async () => {
      const rule = new LocationRequirementRule({ x: 10, y: 10, z: 10 }, 1);
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Not in required location');
    });
  });

  describe('BiomeRequirementRule', () => {
    it('should validate when in correct biome', async () => {
      const rule = new BiomeRequirementRule('plains');
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when in wrong biome', async () => {
      const rule = new BiomeRequirementRule('desert');
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Not in required biome: desert');
    });
  });

  describe('TimeRequirementRule', () => {
    it('should validate when within time range', async () => {
      const rule = new TimeRequirementRule({ start: 5000, end: 7000 });
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when outside time range', async () => {
      const rule = new TimeRequirementRule({ start: 0, end: 1000 });
      validator.addRule(rule);

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Not within required time range');
    });
  });

  describe('Multiple Rules', () => {
    it('should validate when all rules pass', async () => {
      validator.addRule(new InventoryRequirementRule([{ type: 'diamond', quantity: 1 }]));
      validator.addRule(new ToolRequirementRule('diamond_pickaxe'));
      validator.addRule(new BiomeRequirementRule('plains'));

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail and collect all errors when multiple rules fail', async () => {
      validator.addRule(new InventoryRequirementRule([{ type: 'gold', quantity: 1 }]));
      validator.addRule(new ToolRequirementRule('netherite_pickaxe'));
      validator.addRule(new BiomeRequirementRule('desert'));

      const result = await validator.validate(testTask, testContext);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('Missing required item: gold (1 needed)');
      expect(result.errors).toContain('Missing required tool: netherite_pickaxe');
      expect(result.errors).toContain('Not in required biome: desert');
    });
  });
}); 