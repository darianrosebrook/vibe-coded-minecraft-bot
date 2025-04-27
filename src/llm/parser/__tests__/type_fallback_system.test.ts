import { TypeFallbackSystem } from '../type_fallback_system';
import { TaskType } from '../../../types/task';
import { ContextAwareTypeDetectionResult } from '../context_aware_type_detection';

describe('TypeFallbackSystem', () => {
  let system: TypeFallbackSystem;

  beforeEach(() => {
    system = new TypeFallbackSystem();
  });

  describe('resolveType', () => {
    it('should return high confidence for valid mining task with proper context', async () => {
      const detectionResult: ContextAwareTypeDetectionResult = {
        type: 'mining',
        confidence: 0.8,
        contextReasons: ['Has pickaxe', 'Near ore'],
        warnings: [],
        alternatives: []
      };

      const context = {
        equipment: [{ type: 'diamond_pickaxe' }],
        nearbyBlocks: [{ type: 'diamond_ore' }],
        inventory: []
      };

      const result = await system.resolveType(detectionResult, context);
      expect(result.type).toBe('mining');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.alternatives).toHaveLength(0);
    });

    it('should suggest crafting as fallback when missing pickaxe', async () => {
      const detectionResult: ContextAwareTypeDetectionResult = {
        type: 'mining',
        confidence: 0.3,
        contextReasons: [],
        warnings: ['No pickaxe available'],
        alternatives: []
      };

      const context = {
        equipment: [],
        nearbyBlocks: [{ type: 'diamond_ore' }],
        inventory: [{ type: 'oak_log' }]
      };

      const result = await system.resolveType(detectionResult, context);
      expect(result.type).toBe('crafting');
      expect(result.alternatives).toContainEqual(
        expect.objectContaining({
          type: 'crafting',
          confidence: expect.any(Number)
        })
      );
    });

    it('should suggest gathering as fallback when no ore nearby', async () => {
      const detectionResult: ContextAwareTypeDetectionResult = {
        type: 'mining',
        confidence: 0.3,
        contextReasons: [],
        warnings: ['No ore nearby'],
        alternatives: []
      };

      const context = {
        equipment: [{ type: 'diamond_pickaxe' }],
        nearbyBlocks: [{ type: 'oak_log' }],
        inventory: []
      };

      const result = await system.resolveType(detectionResult, context);
      expect(result.alternatives).toContainEqual(
        expect.objectContaining({
          type: 'gathering',
          confidence: expect.any(Number)
        })
      );
    });

    it('should track resolution path through multiple fallbacks', async () => {
      const detectionResult: ContextAwareTypeDetectionResult = {
        type: 'mining',
        confidence: 0.3,
        contextReasons: [],
        warnings: ['No pickaxe available', 'No ore nearby'],
        alternatives: []
      };

      const context = {
        equipment: [],
        nearbyBlocks: [{ type: 'oak_log' }],
        inventory: [{ type: 'oak_log' }]
      };

      const result = await system.resolveType(detectionResult, context);
      expect(result.resolutionPath.length).toBeGreaterThan(1);
      expect(result.resolutionPath).toContain('mining');
      expect(result.resolutionPath).toContain('crafting');
    });
  });

  describe('historicalSuccessRate', () => {
    it('should update success rate based on task outcomes', () => {
      system.updateHistoricalSuccessRate('mining', true);
      system.updateHistoricalSuccessRate('mining', true);
      system.updateHistoricalSuccessRate('mining', false);

      const detectionResult: ContextAwareTypeDetectionResult = {
        type: 'mining',
        confidence: 0.5,
        contextReasons: [],
        warnings: [],
        alternatives: []
      };

      const context = {
        equipment: [{ type: 'diamond_pickaxe' }],
        nearbyBlocks: [{ type: 'diamond_ore' }],
        inventory: []
      };

      // The confidence should be slightly higher due to historical success
      system.resolveType(detectionResult, context).then(result => {
        expect(result.confidence).toBeGreaterThan(0.5);
      });
    });
  });
}); 