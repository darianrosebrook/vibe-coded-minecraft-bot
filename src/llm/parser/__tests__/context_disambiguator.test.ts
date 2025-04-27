import { ContextDisambiguator } from '../context_disambiguator';
import { AmbiguityDetector } from '../ambiguity_detector';
import { TaskContext } from '../../types';
import { TaskType } from '../../../types/task';

describe('ContextDisambiguator', () => {
  let disambiguator: ContextDisambiguator;
  let detector: AmbiguityDetector;
  let mockContext: TaskContext;

  beforeEach(() => {
    detector = new AmbiguityDetector();
    disambiguator = new ContextDisambiguator(detector);
    mockContext = {
      inventory: {
        hasTool: jest.fn().mockReturnValue(true),
        hasMaterials: jest.fn().mockReturnValue(true),
        hasSpace: jest.fn().mockReturnValue(true)
      },
      worldState: {
        nearbyBlocks: [],
        isPathClear: true,
        isRouteSafe: true,
        knownLandmarks: [],
        time: 0
      },
      botState: {
        health: 20,
        hunger: 20
      },
      recentTasks: []
    } as any;
  });

  describe('disambiguate', () => {
    it('should return unambiguous result when not ambiguous', async () => {
      const ambiguityResult = {
        isAmbiguous: false,
        scores: [{
          patternId: 'mining_ore',
          confidence: 0.9,
          contextRelevance: 0.8,
          historicalSuccess: 0.9,
          totalScore: 0.9
        }],
        suggestedTypes: ['mining'],
        contextFactors: {}
      };

      const result = await disambiguator.disambiguate('mine diamond ore', mockContext, ambiguityResult);
      
      expect(result.resolvedType).toBe('mining');
      expect(result.confidence).toBe(0.9);
      expect(result.historicalPatterns).toHaveLength(0);
    });

    it('should consider context factors in disambiguation', async () => {
      const ambiguityResult = {
        isAmbiguous: true,
        scores: [
          {
            patternId: 'mining_ore',
            confidence: 0.8,
            contextRelevance: 0.7,
            historicalSuccess: 0.8,
            totalScore: 0.8
          },
          {
            patternId: 'crafting_tool',
            confidence: 0.7,
            contextRelevance: 0.6,
            historicalSuccess: 0.7,
            totalScore: 0.7
          }
        ],
        suggestedTypes: ['mining', 'crafting'],
        contextFactors: {}
      };

      // Set up context to favor mining
      (mockContext.inventory.hasTool as jest.Mock).mockReturnValue(true);
      (mockContext.worldState.nearbyBlocks as any) = [{ type: 'diamond_ore' }];

      const result = await disambiguator.disambiguate('mine or craft', mockContext, ambiguityResult);
      
      expect(result.resolvedType).toBe('mining');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should consider historical patterns in disambiguation', async () => {
      const ambiguityResult = {
        isAmbiguous: true,
        scores: [
          {
            patternId: 'mining_ore',
            confidence: 0.8,
            contextRelevance: 0.7,
            historicalSuccess: 0.8,
            totalScore: 0.8
          },
          {
            patternId: 'crafting_tool',
            confidence: 0.7,
            contextRelevance: 0.6,
            historicalSuccess: 0.7,
            totalScore: 0.7
          }
        ],
        suggestedTypes: ['mining', 'crafting'],
        contextFactors: {}
      };

      // Add successful historical pattern for crafting
      disambiguator['addHistoricalPattern']({
        command: 'craft pickaxe',
        resolvedType: 'crafting',
        success: true,
        timestamp: Date.now(),
        contextFactors: {}
      });

      const result = await disambiguator.disambiguate('mine or craft', mockContext, ambiguityResult);
      
      expect(result.resolvedType).toBe('crafting');
      expect(result.historicalPatterns).toHaveLength(1);
    });

    it('should consider current state in disambiguation', async () => {
      const ambiguityResult = {
        isAmbiguous: true,
        scores: [
          {
            patternId: 'mining_ore',
            confidence: 0.8,
            contextRelevance: 0.7,
            historicalSuccess: 0.8,
            totalScore: 0.8
          },
          {
            patternId: 'crafting_tool',
            confidence: 0.7,
            contextRelevance: 0.6,
            historicalSuccess: 0.7,
            totalScore: 0.7
          }
        ],
        suggestedTypes: ['mining', 'crafting'],
        contextFactors: {}
      };

      // Set up dangerous state
      mockContext.botState.health = 5;
      mockContext.worldState.time = 14000; // Night time

      const result = await disambiguator.disambiguate('mine or craft', mockContext, ambiguityResult);
      
      expect(result.currentStateRelevance).toBeGreaterThan(0.5);
    });
  });

  describe('historical pattern management', () => {
    it('should maintain history size limit', () => {
      const now = Date.now();
      
      // Add more patterns than the limit
      for (let i = 0; i < 1100; i++) {
        disambiguator['addHistoricalPattern']({
          command: `pattern${i}`,
          resolvedType: 'mining',
          success: true,
          timestamp: now - i * 1000,
          contextFactors: {}
        });
      }

      expect(disambiguator['historicalPatterns']).toHaveLength(1000);
    });

    it('should decay historical pattern relevance', async () => {
      const now = Date.now();
      
      // Add old pattern
      disambiguator['addHistoricalPattern']({
        command: 'old pattern',
        resolvedType: 'mining',
        success: true,
        timestamp: now - 24 * 60 * 60 * 1000, // 24 hours old
        contextFactors: {}
      });

      const ambiguityResult = {
        isAmbiguous: true,
        scores: [{
          patternId: 'mining_ore',
          confidence: 0.8,
          contextRelevance: 0.7,
          historicalSuccess: 0.8,
          totalScore: 0.8
        }],
        suggestedTypes: ['mining'],
        contextFactors: {}
      };

      const result = await disambiguator.disambiguate('mine', mockContext, ambiguityResult);
      
      expect(result.historicalPatterns).toHaveLength(0); // Old pattern should be filtered out
    });
  });
}); 