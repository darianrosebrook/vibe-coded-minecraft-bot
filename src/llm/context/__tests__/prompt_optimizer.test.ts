import { PromptOptimizer } from '../prompt_optimizer';
import { TaskContext } from '../../types';
import { TaskType } from '../../../types/task';

describe('PromptOptimizer', () => {
  let optimizer: PromptOptimizer;
  let mockContext: TaskContext;

  beforeEach(async () => {
    optimizer = new PromptOptimizer();
    mockContext = {
      conversationHistory: [
        { role: 'user', content: 'Mine some diamonds', timestamp: Date.now() },
        { role: 'bot', content: 'I will mine diamonds for you', timestamp: Date.now() }
      ],
      worldState: {
        inventory: {
          items: [
            { name: 'diamond_pickaxe', count: 1 },
            { name: 'torch', count: 64 }
          ],
        },
        position: { x: 100, y: 64, z: -200 },
        surroundings: [
          { type: 'stone', position: { x: 101, y: 64, z: -200 } },
          { type: 'diamond_ore', position: { x: 102, y: 64, z: -200 } }
        ],
        time: 12000
      },
      recentTasks: [
        {
          type: TaskType.MINING,
          parameters: { block: "diamond_ore" },
          status: "success",
          timestamp: Date.now() - 1000,
        },
      ],
      pluginContext: {
        pathfinder: {
          path: [],
          status: 'success',
          timestamp: Date.now()
        },
        autoEat: {
          health: 20,
          hunger: 18,
          status: 'idle',
          timestamp: Date.now()
        }
      }
    };
  });

  describe("Template Registration", () => {
    it("should register a new template", async () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target} at {position}',
        contextRequirements: ['worldState.position', 'worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      await optimizer.registerTemplate(template);
      const versions = await optimizer.getTemplateVersions('mining');
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
    });

    it('should prevent duplicate version registration', async () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      await optimizer.registerTemplate(template);
      await expect(optimizer.registerTemplate(template)).rejects.toThrow();
    });
  });

  describe('Context Selection', () => {
    it('should select relevant context based on requirements', () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target} at {position}',
        contextRequirements: ['worldState.position', 'worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      optimizer.registerTemplate(template);
      const prompt = optimizer.generatePrompt('mining', mockContext);
      
      expect(prompt).toContain('"x": 100');
      expect(prompt).toContain('"type": "diamond_ore"');
    });

    it('should compress context to reduce token usage', () => {
      const template = {
        id: 'inventory',
        version: 1,
        template: 'Check inventory: {inventory}',
        contextRequirements: ['worldState.inventory'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      optimizer.registerTemplate(template);
      const prompt = optimizer.generatePrompt('inventory', mockContext);
      
      // Should contain essential fields but not all metadata
      expect(prompt).toContain('"id": "diamond_pickaxe"');
      expect(prompt).toContain('"count": 1');
      expect(prompt).not.toContain('selectedSlot');
    });
  });

  describe('Prompt Generation', () => {
    it('should format prompt with context values', () => {
      const template = {
        id: 'position',
        version: 1,
        template: 'Current position: {position}',
        contextRequirements: ['worldState.position'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      optimizer.registerTemplate(template);
      const prompt = optimizer.generatePrompt('position', mockContext);
      
      expect(prompt).toContain('Current position:');
      expect(prompt).toContain('"x": 100');
      expect(prompt).toContain('"y": 64');
      expect(prompt).toContain('"z": -200');
    });

    it('should add context metadata when quality threshold is set', () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      optimizer = new PromptOptimizer({ qualityThreshold: 0.8 });
      optimizer.registerTemplate(template);
      const prompt = optimizer.generatePrompt('mining', mockContext);
      
      expect(prompt).toContain('Context Relevance:');
      expect(prompt).toContain('Context Compression:');
    });
  });

  describe('Performance Tracking', () => {
    it('should track metrics for generated prompts', () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      optimizer.registerTemplate(template);
      optimizer.generatePrompt('mining', mockContext);
      
      const metrics = optimizer.getMetrics('mining');
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toHaveProperty('tokenUsage');
      expect(metrics[0]).toHaveProperty('responseQuality');
      expect(metrics[0]).toHaveProperty('contextRelevance');
      expect(metrics[0]).toHaveProperty('generationTime');
    });
  });

  describe('Template Versioning', () => {
    it('should maintain multiple versions of a template', async () => {
      const templateV1 = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      const templateV2 = {
        ...templateV1,
        version: 2,
        template: 'Mine {target} at {position}'
      };

      await optimizer.registerTemplate(templateV1);
      await optimizer.registerTemplate(templateV2);

      const versions = await optimizer.getTemplateVersions('mining');
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(2);
      expect(versions[1].version).toBe(1);
    });

    it('should rollback to a previous version', async () => {
      const templateV1 = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      const templateV2 = {
        ...templateV1,
        version: 2,
        template: 'Mine {target} at {position}'
      };

      await optimizer.registerTemplate(templateV1);
      await optimizer.registerTemplate(templateV2);
      await optimizer.rollbackTemplate('mining', 1);

      const versions = await optimizer.getTemplateVersions('mining');
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
    });
  });

  describe('Performance Suggestions', () => {
    it('should generate suggestions for context relevance', async () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      optimizer = new PromptOptimizer({ minRelevance: 0.8 });
      await optimizer.registerTemplate(template);

      // Generate some low relevance metrics
      for (let i = 0; i < 5; i++) {
        await optimizer.recordMetrics({
          promptId: 'mining',
          tokenUsage: 100,
          responseQuality: 0.9,
          contextRelevance: 0.6,
          generationTime: 100,
          timestamp: Date.now()
        });
      }

      const suggestions = await optimizer.getPerformanceSuggestions('mining');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('context');
      expect(suggestions[0].description).toContain('Context relevance is below threshold');
    });

    it('should generate suggestions for token usage', () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      optimizer = new PromptOptimizer({ maxTokens: 1000 });
      optimizer.registerTemplate(template);

      // Generate some high token usage metrics
      for (let i = 0; i < 5; i++) {
        optimizer.recordMetrics({
          promptId: 'mining',
          tokenUsage: 900,
          responseQuality: 0.9,
          contextRelevance: 0.9,
          generationTime: 100,
          timestamp: Date.now()
        });
      }

      const suggestions = optimizer.getPerformanceSuggestions('mining');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('compression');
      expect(suggestions[0].description).toContain('Token usage is approaching limit');
    });

    it('should generate suggestions for response quality', () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      optimizer = new PromptOptimizer({ qualityThreshold: 0.8 });
      optimizer.registerTemplate(template);

      // Generate some low quality metrics
      for (let i = 0; i < 5; i++) {
        optimizer.recordMetrics({
          promptId: 'mining',
          tokenUsage: 100,
          responseQuality: 0.6,
          contextRelevance: 0.9,
          generationTime: 100,
          timestamp: Date.now()
        });
      }

      const suggestions = optimizer.getPerformanceSuggestions('mining');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('template');
      expect(suggestions[0].description).toContain('Response quality is below threshold');
    });
  });

  describe('Metrics Persistence', () => {
    it('should persist metrics across instances', async () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      // Create first instance and register template
      const optimizer1 = new PromptOptimizer();
      await optimizer1.registerTemplate(template);

      // Create second instance and verify template exists
      const optimizer2 = new PromptOptimizer();
      const versions = await optimizer2.getTemplateVersions('mining');
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
    });

    it('should persist metrics for templates', async () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      await optimizer.registerTemplate(template);

      // Record some metrics
      const metric = {
        promptId: 'mining',
        tokenUsage: 100,
        responseQuality: 0.9,
        contextRelevance: 0.8,
        generationTime: 100,
        timestamp: Date.now()
      };

      await optimizer.recordMetrics(metric);

      // Create new instance and verify metrics
      const optimizer2 = new PromptOptimizer();
      const versions = await optimizer2.getTemplateVersions('mining');
      expect(versions[0].metrics).toHaveLength(1);
      expect(versions[0].metrics[0]).toEqual(metric);
    });

    it('should cleanup old metrics', async () => {
      const template = {
        id: 'mining',
        version: 1,
        template: 'Mine {target}',
        contextRequirements: ['worldState.surroundings'],
        tokenEstimate: 100,
        qualityMetrics: { clarity: 1, specificity: 1, completeness: 1 }
      };

      await optimizer.registerTemplate(template);

      // Record old metric
      const oldMetric = {
        promptId: 'mining',
        tokenUsage: 100,
        responseQuality: 0.9,
        contextRelevance: 0.8,
        generationTime: 100,
        timestamp: Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days old
      };

      // Record recent metric
      const recentMetric = {
        ...oldMetric,
        timestamp: Date.now()
      };

      await optimizer.recordMetrics(oldMetric);
      await optimizer.recordMetrics(recentMetric);

      // Cleanup metrics older than 30 days
      await optimizer.cleanupMetrics(30 * 24 * 60 * 60 * 1000);

      // Create new instance and verify only recent metric exists
      const optimizer2 = new PromptOptimizer();
      const versions = await optimizer2.getTemplateVersions('mining');
      expect(versions[0].metrics).toHaveLength(1);
      expect(versions[0].metrics[0]).toEqual(recentMetric);
    });
  });
}); 