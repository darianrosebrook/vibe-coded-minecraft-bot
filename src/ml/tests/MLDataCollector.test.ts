import { MLDataCollector } from '../data/MLDataCollector';
import { MLDataManager } from '../storage/MLDataManager';
import { EnhancedGameState } from '../state/types';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

describe('MLDataCollector Tests', () => {
  let dataCollector: MLDataCollector;
  let dataManager: MLDataManager;
  let mockBot: Bot;

  beforeEach(() => {
    dataManager = new MLDataManager();
    dataCollector = new MLDataCollector(dataManager);
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

  describe('Interaction Logging', () => {
    it('should log interactions and process data', async () => {
      const mockState = createMockState();
      await dataCollector.logInteraction(
        'mine stone',
        'Mining stone...',
        true,
        1000,
        mockState
      );

      const logs = dataCollector.getInteractionLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].command).toBe('mine stone');
      expect(logs[0].success).toBe(true);

      const features = await dataManager.getFeatures('interaction');
      expect(features.length).toBe(1);
      expect(features[0].commandLength).toBe(10);
    });
  });

  describe('State Change Logging', () => {
    it('should log state changes and detect differences', async () => {
      const stateBefore = createMockState();
      const stateAfter = {
        ...stateBefore,
        health: 19,
        position: new Vec3(1, 0, 0)
      };

      await dataCollector.logStateChange(stateBefore, stateAfter);

      const logs = dataCollector.getStateChangeLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].changes.position).toBe(true);
      expect(logs[0].changes.health).toBe(true);

      const features = await dataManager.getFeatures('stateChange');
      expect(features.length).toBe(1);
      expect(features[0].positionChange).toBe(true);
    });
  });

  describe('Resource Change Logging', () => {
    it('should log resource changes and process data', async () => {
      await dataCollector.logResourceChange(
        'stone',
        10,
        1,
        { x: 0, y: 0, z: 0 }
      );

      const logs = dataCollector.getResourceChangeLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].resourceType).toBe('stone');
      expect(logs[0].change).toBe(1);

      const features = await dataManager.getFeatures('resource');
      expect(features.length).toBe(1);
      expect(features[0].resourceType).toBe('stone');
    });
  });

  describe('Data Clearing', () => {
    it('should clear all logs', async () => {
      const mockState = createMockState();
      await dataCollector.logInteraction(
        'mine stone',
        'Mining stone...',
        true,
        1000,
        mockState
      );
      await dataCollector.logStateChange(mockState, mockState);
      await dataCollector.logResourceChange(
        'stone',
        10,
        1,
        { x: 0, y: 0, z: 0 }
      );

      await dataCollector.clearLogs();

      expect(dataCollector.getInteractionLogs().length).toBe(0);
      expect(dataCollector.getStateChangeLogs().length).toBe(0);
      expect(dataCollector.getResourceChangeLogs().length).toBe(0);
    });
  });
}); 