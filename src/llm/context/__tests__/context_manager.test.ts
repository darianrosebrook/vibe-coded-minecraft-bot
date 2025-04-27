import { ContextManager, GameState, StateChange } from "../manager";
import { Bot } from "mineflayer";
import { Vec3 } from "vec3";

describe("ContextManager", () => {
  let contextManager: ContextManager;
  let mockBot: Bot;
  let mockGameState: GameState;

  beforeEach(() => {
    mockBot = {
      health: 20,
      food: 20,
      position: new Vec3(0, 64, 0),
      inventory: {
        items: () => [],
        slots: () => [],
      },
    } as any;

    mockGameState = {
      health: 20,
      food: 20,
      position: new Vec3(0, 64, 0),
      inventory: {
        items: [],
        totalSlots: 36,
        usedSlots: 0,
      },
      biome: "plains",
      timeOfDay: 0,
      isRaining: false,
      nearbyBlocks: [],
      nearbyEntities: [],
      movement: {
        velocity: new Vec3(0, 0, 0),
        yaw: 0,
        pitch: 0,
        control: {
          sprint: false,
          sneak: false,
        },
      },

      environment: {
        blockAtFeet: "grass",
        blockAtHead: "air",
        lightLevel: 15,
        isInWater: false,
        onGround: true,
      },
      recentTasks: [],
    };

    contextManager = new ContextManager(mockBot);
  });

  describe("Context Tracking", () => {
    it("should track player interaction history", () => {
      const command = "mine diamond ore";
      const response = "I will mine diamond ore for you";

      contextManager.addToHistory("user", command);
      contextManager.addToHistory("bot", response);

      const history = contextManager.getConversationHistory();
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe(command);
      expect(history[1].content).toBe(response);
    });

    it("should track bot state changes", async () => {
      const newState: Partial<GameState> = {
        health: 15,
        food: 10,
        position: new Vec3(10, 64, 10),
      };

      contextManager.updateGameState(newState);
      const currentState = await contextManager.getGameState();

      expect(currentState.health).toBe(15);
      expect(currentState.food).toBe(10);
      expect(currentState.position).toEqual(newState.position);
    });

    it("should track inventory state changes", async () => {
      const inventoryChange = {
        type: "diamond_pickaxe",
        count: 1,
        slot: 0,
      };

      contextManager.updateInventory([inventoryChange]);
      const currentInventory = (await contextManager.getGameState()).inventory;

      expect(currentInventory.items).toHaveLength(1);
      expect(currentInventory.items[0]).toEqual({
        type: inventoryChange.type,
        quantity: inventoryChange.count,
      });
    });

    it("should track recent task history", () => {
      const task = {
        type: "mining",
        parameters: { target: "diamond_ore" },
        status: "success" as const,
        timestamp: Date.now(),
      };

      contextManager.updateTaskHistory(task);
      const recentTasks = contextManager.getRecentTasks();

      expect(recentTasks).toHaveLength(1);
      expect(recentTasks[0]).toEqual(task);
    });
  });

  describe("Context Relevance Scoring", () => {
    it("should calculate context relevance scores", () => {
      const category = "player_interaction";
      contextManager.updateContextRelevance(category);
      const relevance = contextManager.getContextRelevance().get(category);

      expect(relevance).toBeDefined();
      expect(relevance?.score).toBeGreaterThanOrEqual(0);
      expect(relevance?.score).toBeLessThanOrEqual(1);
    });

    it("should apply temporal relevance decay", () => {
      const category = "task_history";
      contextManager.updateContextRelevance(category);
      const initialRelevance =
        contextManager.getContextRelevance().get(category)?.score || 0;

      // Simulate time passing
      jest.advanceTimersByTime(60000); // 1 minute

      contextManager.updateContextRelevance(category);
      const decayedRelevance =
        contextManager.getContextRelevance().get(category)?.score || 0;
      expect(decayedRelevance).toBeLessThan(initialRelevance);
    });

    it("should adjust context weights based on priority", () => {
      const category = "bot_state";
      const initialWeight =
        contextManager.getContextWeights().get(category)?.baseWeight || 0;

      contextManager.adjustContextWeight(category, 0.5);
      const adjustedWeight =
        contextManager.getContextWeights().get(category)?.baseWeight || 0;

      expect(adjustedWeight).toBe(0.5);
    });
  });

  describe("Context Compression", () => {
    it("should compress context when size threshold is exceeded", () => {
      const largeContext: Partial<GameState> = {
        inventory: {
          items: Array(100).fill({ type: "stone", quantity: 64 }),
          totalSlots: 36,
          usedSlots: 100,
        },
      };

      contextManager.updateGameState(largeContext);
      const compressionStats = contextManager.getCompressionStats();

      expect(compressionStats.size).toBeGreaterThan(0);
      expect(contextManager.getCompressionRatio("inventory")).toBeLessThan(1);
    });

    it("should maintain data integrity after compression", () => {
      const originalContext: Partial<GameState> = {
        inventory: {
          items: [{ type: "diamond_pickaxe", quantity: 1 }],
          totalSlots: 36,
          usedSlots: 1,
        },
        position: new Vec3(0, 64, 0),
      };

      contextManager.updateGameState(originalContext);
      const compressedContext = contextManager.getCompressedContext();

      expect(compressedContext.inventory.items[0].type).toBe("diamond_pickaxe");
      expect(compressedContext.position).toEqual(originalContext.position);
    });

    it("should generate context summaries", () => {
      const context: Partial<GameState> = {
        inventory: {
          items: [{ type: "diamond_pickaxe", quantity: 1 }],
          totalSlots: 36,
          usedSlots: 1,
        },
      };

      contextManager.updateGameState(context);
      const summaries = contextManager.getContextSummary();

      expect(summaries.get("inventory")).toContain("diamond_pickaxe");
    });
  });

  describe("Context Versioning", () => {
    it("should create new versions on significant changes", () => {
      const changes: StateChange[] = [
        {
          plugin: "mining",
          changes: { progress: 0.5 },
          previousState: { progress: 0 },
          timestamp: Date.now(),
          cause: "task_update",
        },
      ];

      contextManager.createNewVersion(changes);
      const versions = contextManager.getVersions();

      expect(versions).toHaveLength(1);
      expect(versions[0].changes).toEqual(changes);
    });

    it("should maintain version history within limits", () => {
      // Create more versions than the limit
      for (let i = 0; i < 15; i++) {
        contextManager.createNewVersion([
          {
            plugin: "test",
            changes: { value: i },
            previousState: {},
            timestamp: Date.now(),
            cause: "test",
          },
        ]);
      }

      const versions = contextManager.getVersions();
      expect(versions).toHaveLength(10); // Default maxVersions
    });

    it("should allow rollback to previous versions", async () => {
      const initialState: Partial<GameState> = { health: 20 };
      contextManager.updateGameState(initialState);

      const newState: Partial<GameState> = { health: 15 };
      contextManager.updateGameState(newState);

      const success = contextManager.rollbackToVersion(1);
      const currentState = await contextManager.getGameState();

      expect(success).toBe(true);
      expect((await currentState).health).toBe(20);
    });
  });

  describe("Performance Metrics", () => {
    it("should meet context retrieval time requirement", () => {
      const startTime = performance.now();
      contextManager.getGameState();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // < 100ms
    });

    it("should meet context update time requirement", () => {
      const startTime = performance.now();
      contextManager.updateGameState({ health: 20 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // < 1s
    });

    it("should maintain context relevance score above threshold", () => {
      const relevance = contextManager.getContextRelevance();
      const scores = Array.from(relevance.values()).map((r) => r.score);
      const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(averageScore).toBeGreaterThan(0.9); // > 90%
    });

    it("should maintain context compression loss below threshold", () => {
      const largeContext: Partial<GameState> = {
        inventory: {
          items: Array(100).fill({ type: "stone", quantity: 64 }),
          totalSlots: 36,
          usedSlots: 100,
        },
      };

      contextManager.updateGameState(largeContext);
      const compressionRatio = contextManager.getCompressionRatio("inventory");

      expect(compressionRatio).toBeLessThan(0.1); // < 10% loss
    });
  });
});
