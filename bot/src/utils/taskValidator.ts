import { z } from "zod";
import { Task } from "@/types/task";
import { LLMError } from "./llmClient";

export interface SchemaValidator {
  validate(obj: unknown): Task;
  looksLikeJson(str: string): boolean;
}

// Define the schema for task parameters
const taskParametersSchema = z.object({
  type: z.string(),
  id: z.string(),
  priority: z.number().min(0).max(100).optional(),
  dependencies: z.array(z.string()).optional(),
  data: z.record(z.unknown()).optional(),
  retry: z
    .object({
      maxAttempts: z.number(),
      backoff: z.number(),
      maxDelay: z.number(),
    })
    .optional(),
});

// Define the schema for task validation
const taskSchema = z
  .object({
    type: z.string(),
    id: z.string().optional(),
    priority: z.number().min(0).max(100).optional(),
    dependencies: z.array(z.string()).optional(),
    data: z.record(z.unknown()).optional(),
    parameters: z
      .union([
        z.object({
          block: z.string(),
          quantity: z.number().optional(),
          maxDistance: z.number().optional(),
          yLevel: z.number().optional(),
          usePathfinding: z.boolean().optional(),
        }),
        z.object({
          cropType: z.enum(["wheat", "carrots", "potatoes", "beetroot"]),
          action: z.enum(["harvest", "plant", "replant"]),
          quantity: z.number().optional(),
          radius: z.number().optional(),
          checkInterval: z.number().optional(),
          requiresWater: z.boolean().optional(),
          minWaterBlocks: z.number().optional(),
          usePathfinding: z.boolean().optional(),
        }),
        z.object({
          location: z.object({
            x: z.number(),
            y: z.number(),
            z: z.number(),
          }),
          mode: z.enum(["walk", "sprint", "jump"]).optional(),
          avoidWater: z.boolean().optional(),
          maxDistance: z.number().optional(),
          usePathfinding: z.boolean().optional(),
        }),
        z.object({
          x: z.number(),
          y: z.number(),
          z: z.number(),
          mode: z.enum(["walk", "sprint", "jump"]).optional(),
          avoidWater: z.boolean().optional(),
          maxDistance: z.number().optional(),
          usePathfinding: z.boolean().optional(),
        }),
        z.object({
          itemType: z.string(),
          quantity: z.number(),
          action: z.enum(["check", "count", "sort"]),
        }),
        z.object({
          itemType: z.string(),
          quantity: z.number(),
          maxDistance: z.number().optional(),
        }),
        z.object({
          itemType: z.string(),
          quantity: z.number(),
          processType: z.enum(["smelt", "craft", "brew"]),
        }),
        z.object({
          blockType: z.string(),
          dimensions: z.object({
            x: z.number(),
            y: z.number(),
            z: z.number(),
          }),
          pattern: z.string().optional(),
        }),
        z.object({
          resourceType: z.string().optional(),
          biomeName: z.string().optional(),
          radius: z.number(),
          spacing: z.number().optional(),
          avoidWater: z.boolean().optional(),
          usePathfinding: z.boolean().optional(),
        }),
        z.object({
          itemType: z.string(),
          quantity: z.number(),
          action: z.enum(["store", "retrieve", "organize"]),
        }),
        z.object({
          targetType: z.enum(["player", "mob"]),
          targetName: z.string().optional(),
          weaponSlot: z.number().optional(),
          followDistance: z.number().optional(),
        }),
        z
          .object({
            action: z.enum(["toggle", "monitor", "manage_farm"]),
            target: z
              .object({
                type: z.enum([
                  "lever",
                  "button",
                  "pressure_plate",
                  "redstone_torch",
                  "redstone_block",
                  "repeater",
                  "comparator",
                ]),
                position: z.object({
                  x: z.number(),
                  y: z.number(),
                  z: z.number(),
                }),
                state: z.boolean(),
              })
              .optional(),
            circuit: z
              .object({
                devices: z.array(
                  z.object({
                    type: z.enum([
                      "lever",
                      "button",
                      "pressure_plate",
                      "redstone_torch",
                      "redstone_block",
                      "repeater",
                      "comparator",
                    ]),
                    position: z.object({
                      x: z.number(),
                      y: z.number(),
                      z: z.number(),
                    }),
                    state: z.boolean(),
                  })
                ),
                connections: z.array(
                  z.object({
                    from: z.number(),
                    to: z.number(),
                  })
                ),
              })
              .optional(),
            farmConfig: z
              .object({
                cropTypes: z.array(z.string()),
                radius: z.number(),
                checkInterval: z.number(),
                requiresWater: z.boolean(),
                minWaterBlocks: z.number(),
              })
              .optional(),
          })
          .optional(),
        z.object({
          queryType: z.enum([
            "inventory",
            "position",
            "nearby",
            "status",
            "help",
          ]),
          filters: z
            .object({
              itemType: z.string().optional(),
              minCount: z.number().optional(),
              maxCount: z.number().optional(),
              radius: z.number().optional(),
              blockType: z.string().optional(),
            })
            .optional(),
        }),
        z.object({
          message: z.string(),
          context: z
            .object({
              lastMessage: z.string().optional(),
              playerName: z.string().optional(),
              botState: z
                .object({
                  position: z.object({
                    x: z.number(),
                    y: z.number(),
                    z: z.number(),
                  }),
                  health: z.number(),
                  food: z.number(),
                  inventory: z.array(
                    z.object({
                      name: z.string(),
                      count: z.number(),
                    })
                  ),
                  biome: z.string().optional(),
                  isDay: z.boolean().optional(),
                  isRaining: z.boolean().optional(),
                  nearbyEntities: z
                    .array(
                      z.object({
                        type: z.string(),
                        name: z.string(),
                        distance: z.number(),
                        position: z.object({
                          x: z.number(),
                          y: z.number(),
                          z: z.number(),
                        }),
                      })
                    )
                    .optional(),
                })
                .optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
    retry: z
      .object({
        maxAttempts: z.number(),
        backoff: z.number(),
        maxDelay: z.number(),
      })
      .optional(),
    progress: z.number().optional(),
    requirements: z
      .object({
        items: z
          .array(
            z.object({
              type: z.string(),
              quantity: z.number(),
            })
          )
          .optional(),
        tools: z
          .array(
            z.object({
              type: z.string(),
            })
          )
          .optional(),
      })
      .optional(),
    validation: z
      .object({
        preChecks: z
          .array(
            z.object({
              type: z.string(),
              condition: z.string(),
              error: z.string(),
            })
          )
          .optional(),
        postChecks: z
          .array(
            z.object({
              type: z.string(),
              condition: z.string(),
              error: z.string(),
            })
          )
          .optional(),
      })
      .optional(),
  })
  .transform((data) => ({
    ...data,
    id: data.id || `task-${Date.now()}`,
    priority: data.priority || 50,
    status: "pending" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    dependencies: data.dependencies || [],
    parameters: data.parameters || {},
  }));

export class ZodSchemaValidator implements SchemaValidator {
  validate(obj: unknown): Task {
    try {
      const validated = taskSchema.parse(obj);
      return validated as unknown as Task;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        throw new LLMError(`Validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  looksLikeJson(str: string): boolean {
    try {
      const obj = JSON.parse(str);
      return typeof obj === "object" && obj !== null;
    } catch {
      return false;
    }
  }
}

export const validateTaskType = (obj: unknown): Task => {
  const validator = new ZodSchemaValidator();
  return validator.validate(obj);
};

export const looksLikeJson = (str: string): boolean => {
  const validator = new ZodSchemaValidator();
  return validator.looksLikeJson(str);
};

export function isTask(obj: unknown): obj is Task {
  try {
    taskSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
}

export class TaskValidator {
  private static instance: TaskValidator;
  private schema: z.ZodType<Task>;

  private constructor() {
    this.schema = taskSchema as unknown as z.ZodType<Task>;
  }

  public static getInstance(): TaskValidator {
    if (!TaskValidator.instance) {
      TaskValidator.instance = new TaskValidator();
    }
    return TaskValidator.instance;
  }

  public validateTask(task: Task): { valid: boolean; errors: string[] } {
    if (!task) {
      return { valid: false, errors: ["Task is required"] };
    }

    try {
      const validated = this.schema.parse(task);
      return {
        valid: true,
        errors: [],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((err) => err.message),
        };
      }
      return {
        valid: false,
        errors: ["Unknown validation error occurred"],
      };
    }
  }

  public validateTaskType(type: string): type is Task["type"] {
    return typeof type === "string" && type.length > 0;
  }

  public validateTaskParameters(
    type: Task["type"],
    parameters: unknown
  ): { valid: boolean; errors: string[] } {
    try {
      taskParametersSchema.parse(parameters);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => e.message),
        };
      }
      throw error;
    }
  }
}
