import { ParameterValidator } from "../parameter_validator";
import { TaskContext } from "../../types";

describe("ParameterValidator", () => {
  let validator: ParameterValidator;
  let mockContext: TaskContext;

  beforeEach(() => {
    validator = new ParameterValidator();
    mockContext = {
      inventory: {
        hasTool: jest.fn().mockReturnValue(true),
        hasMaterials: jest.fn().mockReturnValue(true),
      },
      task: undefined,
    } as any;
  });

  describe("validateParameters", () => {
    it("should validate mining parameters correctly", async () => {
      const result = await validator.validateParameters(
        "mining",
        {
          block: "stone",
          quantity: 10,
          tool: "pickaxe",
        },
        mockContext
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.validatedParameters).toEqual({
        block: "stone",
        quantity: 10,
        tool: "pickaxe",
      });
    });

    it("should fail mining validation with missing required parameters", async () => {
      const result = await validator.validateParameters(
        "mining",
        {
          block: "stone",
          // quantity and tool are missing
        },
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Required parameter 'quantity' is missing"
      );
      expect(result.errors).toContain("Required parameter 'tool' is missing");
    });

    it("should validate crafting parameters correctly", async () => {
      const result = await validator.validateParameters(
        "crafting",
        {
          recipe: "wooden_pickaxe",
          materials: ["planks", "sticks"],
        },
        mockContext
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.validatedParameters).toEqual({
        recipe: "wooden_pickaxe",
        materials: ["planks", "sticks"],
      });
    });

    it("should validate navigation parameters correctly", async () => {
      const result = await validator.validateParameters(
        "navigation",
        {
          destination: { x: 10, y: 64, z: -20 },
        },
        mockContext
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.validatedParameters).toEqual({
        destination: { x: 10, y: 64, z: -20 },
      });
    });

    it("should fail navigation validation with invalid coordinates", async () => {
      const result = await validator.validateParameters(
        "navigation",
        {
          destination: { x: "invalid", y: 64, z: -20 },
        },
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Validation failed for parameter 'destination': Complex validation failed"
      );
    });

    it("should handle numeric validation constraints", async () => {
      const result = await validator.validateParameters(
        "mining",
        {
          block: "stone",
          quantity: -5, // Invalid: below minimum of 1
          tool: "pickaxe",
        },
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Validation failed for parameter 'quantity': Value must be at least 1"
      );
    });

    it("should handle string validation constraints", async () => {
      validator.addSchema("test", {
        name: {
          type: "string",
          minLength: 3,
          maxLength: 10,
          pattern: "^[a-z]+$",
          required: true,
        },
      });

      const result = await validator.validateParameters(
        "test",
        {
          name: "a", // Too short and doesn't match pattern
        },
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "String must be at least 3 characters long"
      );
      expect(result.errors).toContain("String must match pattern: ^[a-z]+$");
    });

    it("should handle boolean validation", async () => {
      validator.addSchema("test", {
        enabled: {
          type: "boolean",
          required: true,
        },
      });

      const result = await validator.validateParameters(
        "test",
        {
          enabled: "true",
        },
        mockContext
      );

      expect(result.isValid).toBe(true);
      expect(result.validatedParameters.enabled).toBe(true);
    });

    it("should handle complex validation with nested schemas", async () => {
      validator.addSchema("test", {
        config: {
          type: "complex",
          schema: {
            name: "string",
            value: "number",
            enabled: "boolean",
          },
          required: true,
        },
      });

      const result = await validator.validateParameters(
        "test",
        {
          config: {
            name: "test",
            value: 42,
            enabled: true,
          },
        },
        mockContext
      );

      expect(result.isValid).toBe(true);
      expect(result.validatedParameters.config).toEqual({
        name: "test",
        value: 42,
        enabled: true,
      });
    });
  });
});
