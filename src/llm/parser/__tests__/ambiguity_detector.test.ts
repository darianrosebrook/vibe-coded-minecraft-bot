import { AmbiguityDetector } from "../ambiguity_detector";
import { TaskContext } from "@/types";

describe("AmbiguityDetector", () => {
  let detector: AmbiguityDetector;
  let mockContext: TaskContext;

  beforeEach(() => {
    detector = new AmbiguityDetector();
    mockContext = {
      worldState: {
        inventory: {
          hasTool: jest.fn().mockReturnValue(true),
          hasMaterials: jest.fn().mockReturnValue(true),
          hasSpace: jest.fn().mockReturnValue(true),
        },
        surroundings: [],
        isPathClear: true,
        isRouteSafe: true,
        knownLandmarks: [],
      },
    } as any;
  });

  describe("detectAmbiguity", () => {
    it("should detect unambiguous mining command", async () => {
      const result = await detector.detectAmbiguity(
        "mine diamond ore",
        mockContext
      );

      expect(result.isAmbiguous).toBe(false);
      expect(result.suggestedTypes).toContain("mining");
      expect(result.scores).toHaveLength(1);
      expect(result.scores[0].patternId).toBe("mining_ore");
    });

    it("should detect unambiguous crafting command", async () => {
      const result = await detector.detectAmbiguity(
        "craft wooden pickaxe",
        mockContext
      );

      expect(result.isAmbiguous).toBe(false);
      expect(result.suggestedTypes).toContain("crafting");
      expect(result.scores).toHaveLength(1);
      expect(result.scores[0].patternId).toBe("crafting_tool");
    });

    it("should detect unambiguous navigation command", async () => {
      const result = await detector.detectAmbiguity(
        "go to 100 64 -200",
        mockContext
      );

      expect(result.isAmbiguous).toBe(false);
      expect(result.suggestedTypes).toContain("navigation");
      expect(result.scores).toHaveLength(1);
      expect(result.scores[0].patternId).toBe("navigation_coordinates");
    });

    it("should detect ambiguous command with multiple matches", async () => {
      const result = await detector.detectAmbiguity(
        "go to village",
        mockContext
      );

      expect(result.isAmbiguous).toBe(true);
      expect(result.suggestedTypes).toContain("navigation");
      expect(result.scores).toHaveLength(1);
      expect(result.scores[0].patternId).toBe("navigation_landmark");
    });

    it("should consider context factors in scoring", async () => {
      (mockContext.worldState.inventory.hasTool as jest.Mock).mockReturnValue(
        false
      );
      (mockContext.worldState.surroundings as any) = [{ type: "diamond_ore" }];

      const result = await detector.detectAmbiguity(
        "mine diamond ore",
        mockContext
      );

      expect(result.contextFactors["has_pickaxe"]).toBeDefined();
      expect(result.contextFactors["near_ore"]).toBeDefined();
      expect(result.scores[0].contextRelevance).toBeLessThan(1);
    });
  });

  describe("historical success tracking", () => {
    it("should update historical success rates", () => {
      detector.updateHistoricalSuccess("mining_ore", true);
      detector.updateHistoricalSuccess("mining_ore", true);

      const result = detector["getHistoricalSuccess"]("mining_ore");
      expect(result).toBeGreaterThan(0.5);
    });

    it("should decrease success rate on failures", () => {
      detector.updateHistoricalSuccess("mining_ore", true);
      detector.updateHistoricalSuccess("mining_ore", false);

      const result = detector["getHistoricalSuccess"]("mining_ore");
      expect(result).toBeLessThan(0.6);
    });
  });

  describe("pattern matching", () => {
    it("should match mining patterns correctly", async () => {
      const patterns = [
        "mine diamond ore",
        "mine iron block",
        "mine stone",
        "mine cobblestone",
      ];

      for (const pattern of patterns) {
        const result = await detector.detectAmbiguity(pattern, mockContext);
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0].patternId).toMatch(/^mining_/);
      }
    });

    it("should match crafting patterns correctly", async () => {
      const patterns = [
        "craft wooden pickaxe",
        "craft iron sword",
        "craft planks",
        "craft sticks",
      ];

      for (const pattern of patterns) {
        const result = await detector.detectAmbiguity(pattern, mockContext);
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0].patternId).toMatch(/^crafting_/);
      }
    });

    it("should match navigation patterns correctly", async () => {
      const patterns = [
        "go to 100 64 -200",
        "go to village",
        "go to temple",
        "go to nether",
      ];

      for (const pattern of patterns) {
        const result = await detector.detectAmbiguity(pattern, mockContext);
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0].patternId).toMatch(/^navigation_/);
      }
    });
  });
});
