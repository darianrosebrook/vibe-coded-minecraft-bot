import { MinecraftBot } from '../../../bot/bot';
import { HotspotIntegration } from '../HotspotIntegration';
import { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';

// Mock MinecraftBot
jest.mock('../../../bot/bot', () => {
  return {
    MinecraftBot: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      once: jest.fn(),
      off: jest.fn()
    }))
  };
});

 const createMockBlock = (name: string): Block => {
  return {
    name,
    position: new Vec3(0, 0, 0),
    stateId: 0,
  } as Block;
};

describe('HotspotIntegration', () => {
  let bot: MinecraftBot;
  let integration: HotspotIntegration;

  beforeEach(() => {
    bot = new MinecraftBot({
      host: 'localhost',
      port: 25565,
      username: 'test',
      version: '1.20.1'
    });
    integration = new HotspotIntegration(bot);
  });

  describe('isValuableResource', () => {
    it('should return true for valuable blocks', () => {
      const block = createMockBlock('diamond_ore');
      expect(integration['isValuableResource'](block)).toBe(true);
    });

    it('should return false for non-valuable blocks', () => {
      const nonValuableBlock = createMockBlock('dirt');
      expect(integration['isValuableResource'](nonValuableBlock)).toBe(false);
    });
  });

  describe('isFarmableBlock', () => {
    it('should return true for farmable blocks', () => {
      const block = createMockBlock('wheat');
      expect(integration['isFarmableBlock'](block)).toBe(true);
    });

    it('should return false for non-farmable blocks', () => {
      const nonFarmableBlock = createMockBlock('stone');
      expect(integration['isFarmableBlock'](nonFarmableBlock)).toBe(false);
    });
  });

  describe('calculateYield', () => {
    it('should return correct yield for different blocks', () => {
      const block = createMockBlock('diamond_ore');
      const expectedYield = 1;
      expect(integration['calculateYield'](block)).toBe(expectedYield);
    });
  });
}); 