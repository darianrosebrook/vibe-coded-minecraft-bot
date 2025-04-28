import { MLFeedbackSystem } from '../feedback/MLFeedbackSystem';
import { MLErrorSystem } from '../error/MLErrorSystem';
import { MLDataManager } from '../storage/MLDataManager';
import { EnhancedGameState } from '@/types';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

describe('ML Integration Tests', () => {
  let feedbackSystem: MLFeedbackSystem;
  let errorSystem: MLErrorSystem;
  let dataManager: MLDataManager;
  let mockBot: Bot;

  beforeEach(() => {
    feedbackSystem = new MLFeedbackSystem();
    errorSystem = new MLErrorSystem();
    dataManager = new MLDataManager();
    mockBot = {} as Bot;
  });

  const createMockState = (): EnhancedGameState => ({
    bot: mockBot,
    timestamp: Date.now(),
    position: new Vec3(0, 0, 0),
    health: 20,
    food: 20,
    biome: { name: 'plains', temperature: 0.8, rainfall: 0.4 },
    timeOfDay: 6000,
    isRaining: false,
    nearbyBlocks: [],
    nearbyEntities: [],
    movement: {
      velocity: new Vec3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      control: { sprint: false, sneak: false }
    },
    environment: {
      blockAtFeet: 'grass',
      blockAtHead: 'air',
      lightLevel: 15,
      isInWater: false,
      onGround: true
    },
    recentTasks: [],
    inventory: {
      items: () => [],
      emptySlots: () => 36,
      slots: []
    },
    players: {},
    tasks: []
  });

  describe('Feedback System Integration', () => {
    it('should process feedback and trigger model updates', async () => {
      const mockState = createMockState();
      const feedback = {
        taskId: 'test_task',
        success: true,
        executionTime: 1000,
        stateBefore: mockState,
        stateAfter: mockState,
        context: {
          command: 'mine stone',
          biome: 'plains',
          timeOfDay: 6000
        }
      };

      await feedbackSystem.processFeedback(feedback);
      const version = feedbackSystem.getModelVersion('test_task');
      expect(version).toBeGreaterThan(0);
    });
  });

  describe('Error System Integration', () => {
    it('should detect and recover from errors', async () => {
      const mockState = createMockState();
      const error = await errorSystem.detectError(mockState);
      expect(error).not.toBeNull();
      
      const recoverySuccess = await errorSystem.attemptRecovery(error!);
      expect(recoverySuccess).toBe(true);
    });
  });

  describe('Data Management Integration', () => {
    it('should store and retrieve data with versioning', async () => {
      const mockState = createMockState();
      await dataManager.storeGameState(mockState);
      const version = dataManager.getVersionHistory('gameState');
      expect(version.length).toBe(1);

      const retrievedData = await dataManager.getData('gameState');
      expect(retrievedData).not.toBeNull();
    });

    it('should handle rollbacks correctly', async () => {
      const mockState = createMockState();
      await dataManager.storeGameState(mockState);
      const success = await dataManager.rollback('gameState', 1);
      expect(success).toBe(true);
    });
  });

  describe('End-to-End Integration', () => {
    it('should handle complete ML pipeline', async () => {
      const mockState = createMockState();
      await dataManager.storeGameState(mockState);

      const error = await errorSystem.detectError(mockState);
      if (error) {
        await errorSystem.attemptRecovery(error);
      }

      const feedback = {
        taskId: 'test_task',
        success: true,
        executionTime: 1000,
        stateBefore: mockState,
        stateAfter: mockState,
        context: {
          command: 'mine stone',
          biome: 'plains',
          timeOfDay: 6000
        }
      };
      await feedbackSystem.processFeedback(feedback);

      const versionHistory = dataManager.getVersionHistory('gameState');
      expect(versionHistory.length).toBeGreaterThan(0);
    });
  });
}); 