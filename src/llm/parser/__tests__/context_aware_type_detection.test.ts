import { ContextAwareTypeDetector } from "../context_aware_type_detection";
import { Task, TaskType, TaskStatus, TaskPriority, CraftingTaskParameters, TaskParameters } from "../../../types/task";
import { WorldState } from "../../../types/world";
import { Hotspot } from "../../../types/hotspot";

describe("ContextAwareTypeDetector", () => {
  let detector: ContextAwareTypeDetector;
  let mockBotState: any;
  let mockWorldState: WorldState;
  let mockResourceTrackers: Map<string, any>;
  let mockHotspots: Map<string, Hotspot>;

  beforeEach(() => {
    mockBotState = {
      health: 20,
      hunger: 20,
      position: { x: 0, y: 64, z: 0 },
      inventory: [
        { type: "diamond_pickaxe", count: 1, slot: 0 },
        { type: "diamond", count: 5, slot: 1 },
      ],
      equipment: [
        { type: "diamond_pickaxe", durability: 100, slot: "mainhand" },
      ],
      activeTasks: [],
    };

    mockWorldState = {
      time: 0,
      weather: "clear",
      difficulty: "normal",
      gameMode: "survival",
      dimension: "overworld",
    };

    mockResourceTrackers = new Map([
      [
        "diamond_ore",
        {
          type: "diamond_ore",
          locations: [{ x: 10, y: 12, z: 15 }],
          lastSeen: Date.now(),
          yieldHistory: [1, 1, 1],
        },
      ],
    ]);

    mockHotspots = new Map([
      [
        "diamond_ore",
        {
          resourceType: "diamond_ore",
          center: { x: 10, y: 12, z: 15 },
          radius: 10,
          averageYield: 1,
          lastUpdated: Date.now(),
          resourceCount: 5,
        },
      ],
    ]);

    detector = new ContextAwareTypeDetector(
      mockBotState,
      mockWorldState,
      mockResourceTrackers,
      mockHotspots
    );
  });

  describe("detectTaskType", () => {
    it("should return high confidence for valid mining task", async () => {
      const task: Task = {
        type: TaskType.MINING,
        parameters: {
          block: "diamond_ore",
          quantity: 1,
        },
        status: TaskStatus.PENDING,
        id: "1",
        priority: TaskPriority.HIGH,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await detector.detectTaskType(task);
      expect(result.type).toBe("mining");
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.warnings).toHaveLength(0);
    });

    it("should suggest gathering task when missing required items", async () => {
      const task: Task = {
        type: TaskType.CRAFTING,
        parameters: {
          recipe: "diamond_sword",
          materials: ["diamond", "stick"],
        } as unknown as TaskParameters,
        status: TaskStatus.PENDING,
        id: "2",
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBotState.inventory = [{ type: "diamond", count: 1, slot: 0 }];

      const result = await detector.detectTaskType(task);
      expect(result.type).toBe("gathering");
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.alternatives).toContainEqual(
        expect.objectContaining({
          type: "gathering",
          confidence: 0.7,
        })
      );
    });

    it("should suggest healing task when health is low", async () => {
      const task: Task = {
        type: TaskType.MINING,
        parameters: {
          block: "diamond_ore",
          quantity: 1,
        },
        status: TaskStatus.PENDING,
        id: "3",
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBotState.health = 5;

      const result = await detector.detectTaskType(task);
      expect(result.type).toBe("healing");
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.alternatives).toContainEqual(
        expect.objectContaining({
          type: "healing",
          confidence: 0.9,
        })
      );
    });

    it("should suggest crafting task when missing required tools", async () => {
      const task: Task = {
        type: TaskType.CRAFTING,
        parameters: {
          recipe: "diamond_sword",
          materials: ["diamond", "stick"],
        } as unknown as TaskParameters,
        status: TaskStatus.PENDING,
        id: "4",
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBotState.equipment = [];

      const result = await detector.detectTaskType(task);
      expect(result.type).toBe("crafting");
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.alternatives).toContainEqual(
        expect.objectContaining({
          type: "crafting",
          confidence: 0.8,
        })
      );
    });

    it("should handle task dependencies", async () => {
      const task: Task = {
        type: TaskType.MINING,
        parameters: {
          block: "diamond_ore",
          quantity: 1,
        } as unknown as TaskParameters,
        status: TaskStatus.PENDING,
        id: "5",
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBotState.activeTasks = [
        {
          type: TaskType.CRAFTING,
          parameters: { recipe: "diamond_pickaxe" },
          status: TaskStatus.IN_PROGRESS,
        },
      ];

      const result = await detector.detectTaskType(task);
      expect(result.warnings).toContain("Unmet dependencies: crafting");
      expect(result.confidence).toBeLessThan(0.8);
    });

    it("should check resource availability", async () => {
      const task: Task = {
        type: TaskType.MINING,
        parameters: {
          block: "emerald_ore",
          quantity: 1,
        } as unknown as TaskParameters,
        status: TaskStatus.PENDING,
        id: "6",
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await detector.detectTaskType(task);
      expect(result.warnings).toContain("Unavailable resources: emerald_ore");
      expect(result.confidence).toBeLessThan(0.8);
    });

    it("should check position requirements", async () => {
      const task: Task = {
        type: TaskType.MINING,
        parameters: {
          block: "diamond_ore",
          quantity: 1,
        } as unknown as TaskParameters,
        status: TaskStatus.PENDING,
        id: "7",
        priority: TaskPriority.MEDIUM,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await detector.detectTaskType(task);
      expect(result.warnings).toContain("Distance to target:");
      expect(result.confidence).toBeLessThan(0.8);
    });
  });
});
