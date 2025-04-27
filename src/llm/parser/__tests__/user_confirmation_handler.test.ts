import { UserConfirmationHandler } from '../user_confirmation_handler';
import { ContextDisambiguator } from '../context_disambiguator';
import { TaskType } from '../../../types/task';
import { TaskContext } from '../../types';
import { AmbiguityDetector } from '../ambiguity_detector';

describe('UserConfirmationHandler', () => {
  let handler: UserConfirmationHandler;
  let disambiguator: ContextDisambiguator;
  let mockContext: TaskContext;

  beforeEach(() => {
    disambiguator = new ContextDisambiguator(new AmbiguityDetector());
    handler = new UserConfirmationHandler(disambiguator);
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

  describe('handleAmbiguousCommand', () => {
    it('should return task type directly if confidence is high', async () => {
      const disambiguationResult = {
        resolvedType: 'mining' as TaskType,
        confidence: 0.95,
        contextFactors: {},
        historicalPatterns: [],
        currentStateRelevance: 0.8
      };

      const result = await handler.handleAmbiguousCommand('mine diamond', mockContext, disambiguationResult);
      
      expect(result).toBe('mining');
    });

    it('should create confirmation prompt for ambiguous commands', async () => {
      const disambiguationResult = {
        resolvedType: 'mining' as TaskType,
        confidence: 0.7,
        contextFactors: { hasPickaxe: 0.8 },
        historicalPatterns: ['craft pickaxe'],
        currentStateRelevance: 0.8
      };

      const result = await handler.handleAmbiguousCommand('mine diamond', mockContext, disambiguationResult);
      
      expect(result).toHaveProperty('command', 'mine diamond');
      expect(result).toHaveProperty('options');
      expect((result as any).options).toHaveLength(2); // Primary option + historical pattern
    });

    it('should include context factors in option descriptions', async () => {
      const disambiguationResult = {
        resolvedType: 'mining' as TaskType,
        confidence: 0.7,
        contextFactors: { hasPickaxe: 0.8, nearbyOre: 0.9 },
        historicalPatterns: [],
        currentStateRelevance: 0.8
      };

      const result = await handler.handleAmbiguousCommand('mine diamond', mockContext, disambiguationResult);
      
      const description = (result as any).options[0].description;
      expect(description).toContain('hasPickaxe');
      expect(description).toContain('nearbyOre');
    });
  });

  describe('processConfirmation', () => {
    it('should process valid confirmations', async () => {
      const disambiguationResult = {
        resolvedType: TaskType.MINING,
        confidence: 0.7,
        contextFactors: {},
        historicalPatterns: [],
        currentStateRelevance: 0.8
      };

      await handler.handleAmbiguousCommand('mine diamond', mockContext, disambiguationResult);
      const success = await handler.processConfirmation('mine diamond', TaskType.MINING, mockContext);
      
      expect(success).toBe(true);
      expect(handler.getPendingConfirmation('mine diamond')).toBeUndefined();
    });

    it('should reject invalid confirmations', async () => {
      const disambiguationResult = {
        resolvedType: TaskType.MINING,
        confidence: 0.7,
        contextFactors: {},
        historicalPatterns: [],
        currentStateRelevance: 0.8
      };

      await handler.handleAmbiguousCommand('mine diamond', mockContext, disambiguationResult);
      const success = await handler.processConfirmation('mine diamond', TaskType.CRAFTING, mockContext);
      
      expect(success).toBe(false);
      expect(handler.getPendingConfirmation('mine diamond')).toBeDefined();
    });

    it('should record successful confirmations in historical patterns', async () => {
      const disambiguationResult = {
        resolvedType: TaskType.MINING,
        confidence: 0.7,
        contextFactors: {},
        historicalPatterns: [],
        currentStateRelevance: 0.8
      };

      await handler.handleAmbiguousCommand('mine diamond', mockContext, disambiguationResult);
      await handler.processConfirmation('mine diamond', TaskType.MINING, mockContext);

      // Verify the pattern was added to the disambiguator
      const patterns = disambiguator['historicalPatterns'];
      expect(patterns).toHaveLength(1);
      expect(patterns[0].command).toBe('mine diamond');
      expect(patterns[0].resolvedType).toBe('mining');
    });
  });

  describe('confirmation management', () => {
    it('should clean up expired confirmations', async () => {
      const disambiguationResult = {
        resolvedType: TaskType.MINING,
        confidence: 0.7,
        contextFactors: {},
        historicalPatterns: [],
        currentStateRelevance: 0.8
      };

      await handler.handleAmbiguousCommand('mine diamond', mockContext, disambiguationResult);
      
      // Fast-forward time
      jest.advanceTimersByTime(31000); // 31 seconds
      
      handler.cleanupExpiredConfirmations();
      expect(handler.getPendingConfirmation('mine diamond')).toBeUndefined();
    });

    it('should maintain maximum number of pending confirmations', async () => {
      const disambiguationResult = {
        resolvedType: TaskType.MINING,
        confidence: 0.7,
        contextFactors: {},
        historicalPatterns: [],
        currentStateRelevance: 0.8
      };

      // Add more confirmations than the limit
      for (let i = 0; i < 15; i++) {
        await handler.handleAmbiguousCommand(`command${i}`, mockContext, disambiguationResult);
      }

      // Verify only the most recent ones are kept
      expect(handler.getPendingConfirmation('command0')).toBeUndefined();
      expect(handler.getPendingConfirmation('command14')).toBeDefined();
    });
  });
}); 