import { HotspotTracker } from '../HotspotTracker';
import { Vec3 } from 'vec3';

describe('HotspotTracker', () => {
  let tracker: HotspotTracker;

  beforeEach(() => {
    tracker = new HotspotTracker();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should record and track resources', () => {
    const position = new Vec3(0, 0, 0);
    tracker.recordResource(position, 'diamond_ore', 1);
    
    const hotspot = tracker.getBestHotspot('diamond_ore');
    expect(hotspot).toBeDefined();
    expect(hotspot?.resourceType).toBe('diamond_ore');
  });

  test('should identify hotspots from multiple data points', () => {
    // Create a cluster of diamond ore
    for (let i = 0; i < 15; i++) {
      const position = new Vec3(100 + i, 64, -200);
      tracker.recordResource(position, 'diamond_ore', 1);
    }

    const hotspot = tracker.getBestHotspot('diamond_ore');
    expect(hotspot).toBeDefined();
    expect(hotspot?.confidence).toBeGreaterThan(0);
  });

  test('should handle multiple resource types', () => {
    // Record some diamond ore
    for (let i = 0; i < 15; i++) {
      const position = new Vec3(100 + i, 64, -200);
      tracker.recordResource(position, 'diamond_ore', 1);
    }

    // Record some iron ore
    for (let i = 0; i < 15; i++) {
      const position = new Vec3(200 + i, 64, -300);
      tracker.recordResource(position, 'iron_ore', 1);
    }

    const diamondHotspot = tracker.getBestHotspot('diamond_ore');
    const ironHotspot = tracker.getBestHotspot('iron_ore');

    expect(diamondHotspot).toBeDefined();
    expect(ironHotspot).toBeDefined();
    expect(diamondHotspot?.resourceType).toBe('diamond_ore');
    expect(ironHotspot?.resourceType).toBe('iron_ore');
  });

  test('should apply temporal decay to confidence', () => {
    const position = new Vec3(0, 0, 0);
    tracker.recordResource(position, 'diamond_ore', 1);
    
    const initialHotspot = tracker.getBestHotspot('diamond_ore');
    expect(initialHotspot?.confidence).toBe(0.1);

    // Simulate time passing
    jest.advanceTimersByTime(24 * 60 * 60 * 1000); // 24 hours

    const agedHotspot = tracker.getBestHotspot('diamond_ore');
    expect(agedHotspot?.confidence).toBeLessThan(0.1);
  });

  test('should handle resource yield values', () => {
    // Record some redstone ore (which has higher yield)
    for (let i = 0; i < 15; i++) {
      const position = new Vec3(100 + i, 64, -200);
      tracker.recordResource(position, 'redstone_ore', 4); // Redstone drops 4-5 items
    }

    const hotspot = tracker.getBestHotspot('redstone_ore');
    expect(hotspot?.confidence).toBeGreaterThan(0.1);
  });
}); 