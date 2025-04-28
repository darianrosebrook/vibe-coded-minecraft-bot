
import { MinecraftBot } from "@/bot";

export type ErrorCategory =
  | "NETWORK"
  | "PATHFINDING"
  | "INVENTORY"
  | "BLOCK_INTERACTION"
  | "ENTITY_INTERACTION"

  | "LLM"
  | "UNKNOWN";

export type ErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  taskId: string;
  taskType: string;
  location?: { x: number; y: number; z: number };
  timestamp: number;
  retryCount: number;
  error: Error;
  metadata?: Record<string, any>;
}

export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  shouldRetry: (context: ErrorContext) => boolean;
}

export interface FallbackStrategy {
  shouldFallback: (context: ErrorContext) => boolean;
  execute: (context: ErrorContext) => Promise<void>;
}

export class ErrorHandler {
  private bot: MinecraftBot;
  private errorCount: number = 0;
  private lastErrorTime: number = 0;
  private errorThreshold: number = 5;
  private errorWindow: number = 60000; // 1 minute
  private retryStrategies: Map<ErrorCategory, RetryStrategy>;
  private fallbackStrategies: Map<ErrorCategory, FallbackStrategy[]>;

  constructor(bot: MinecraftBot) {
    this.bot = bot;
    this.retryStrategies = new Map();
    this.fallbackStrategies = new Map();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Network errors - retry with exponential backoff
    this.retryStrategies.set("NETWORK", {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      shouldRetry: (context) => context.retryCount < 5,
    });

    // Pathfinding errors - try alternative paths
    this.retryStrategies.set("PATHFINDING", {
      maxRetries: 3,
      baseDelay: 500,
      maxDelay: 5000,
      backoffFactor: 1.5,
      shouldRetry: (context) => context.retryCount < 3,
    });

    // Inventory errors - try to manage inventory
    this.retryStrategies.set("INVENTORY", {
      maxRetries: 2,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 1.5,
      shouldRetry: (context) => context.retryCount < 2,
    });

    // Block interaction errors - try different approaches
    this.retryStrategies.set("BLOCK_INTERACTION", {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      shouldRetry: (context) => context.retryCount < 3,
    });

    // Initialize fallback strategies
    this.fallbackStrategies.set("NETWORK", [
      {
        shouldFallback: (context) => context.retryCount >= 5,
        execute: async (context) => {
          // Try to reconnect to the server
          await this.bot.reconnect();
        },
      },
    ]);

    this.fallbackStrategies.set("PATHFINDING", [
      {
        shouldFallback: (context) => context.retryCount >= 3,
        execute: async (context) => {
          // No fallback available for pathfinding errors
          throw new Error("Pathfinding error: no fallback available");
        },
      },
    ]);

    this.fallbackStrategies.set("INVENTORY", [
      {
        shouldFallback: (context) => context.retryCount >= 2,
        execute: async (context) => {
          // No fallback available for inventory errors
          throw new Error("Inventory error: no fallback available");
        },
      },
    ]);
  }

  public async handleError(error: Error, context: ErrorContext): Promise<void> {
    const strategy = this.retryStrategies.get(context.category);
    const fallbacks = this.fallbackStrategies.get(context.category) || [];

    if (strategy && strategy.shouldRetry(context)) {
      const delay = Math.min(
        strategy.baseDelay *
        Math.pow(strategy.backoffFactor, context.retryCount),
        strategy.maxDelay
      );

      console.log(
        `Retrying ${context.category} error (attempt ${context.retryCount + 1
        }/${strategy.maxRetries}) after ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      throw error; // Re-throw to trigger retry
    }

    // Try fallback strategies
    for (const fallback of fallbacks) {
      if (fallback.shouldFallback(context)) {
        try {
          await fallback.execute(context);
          return; // Successfully handled by fallback
        } catch (fallbackError) {
          console.error("Fallback strategy failed:", fallbackError);
        }
      }
    }

    // If we get here, all retries and fallbacks failed
    throw new Error(
      `Failed to handle ${context.category} error after all retries and fallbacks: ${error.message}`
    );
  }

  public categorizeError(error: Error): ErrorCategory {
    if (
      error.message.includes("network") ||
      error.message.includes("connection")
    ) {
      return "NETWORK";
    }
    if (
      error.message.includes("path") ||
      error.message.includes("navigation")
    ) {
      return "PATHFINDING";
    }
    if (error.message.includes("inventory") || error.message.includes("full")) {
      return "INVENTORY";
    }
    if (error.message.includes("block") || error.message.includes("dig")) {
      return "BLOCK_INTERACTION";
    }
    if (error.message.includes("entity") || error.message.includes("mob")) {
      return "ENTITY_INTERACTION";
    }
    if (error.message.includes("llm") || error.message.includes("ollama")) {
      return "LLM";
    }
    return "UNKNOWN";
  }

  public determineSeverity(
    error: Error,
    category: ErrorCategory
  ): ErrorSeverity {
    switch (category) {
      case "NETWORK":
        return "CRITICAL";
      case "PATHFINDING":
        return "HIGH";
      case "INVENTORY":
        return "MEDIUM";
      case "BLOCK_INTERACTION":
        return "MEDIUM";
      case "ENTITY_INTERACTION":
        return "LOW";
      case "LLM":
        return "HIGH";
      default:
        return "MEDIUM";
    }
  }
}
