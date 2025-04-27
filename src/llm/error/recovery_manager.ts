import { 
  ParsingErrorType,
  ParsingErrorContext,
} from "./parsingErrorHandler";
import { TaskParsingLogger } from "../logging/logger";

interface RecoveryStrategy {
  name: string;
  priority: number;
  maxRetries: number;
  backoffStrategy: (attempt: number) => number;
  execute: (error: Error, context: ParsingErrorContext) => Promise<boolean>;
}

export class ErrorRecoveryManager {
  private strategies: Map<ParsingErrorType, RecoveryStrategy[]>;
  private logger: TaskParsingLogger;
  private retryCounts: Map<string, number>;

  constructor(logger: TaskParsingLogger) {
    this.logger = logger;
    this.strategies = new Map();
    this.retryCounts = new Map();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // LLM Service Error Recovery
    this.addStrategy("LLM_SERVICE_ERROR", {
      name: "llm_service_reconnect",
      priority: 1,
      maxRetries: 3,
      backoffStrategy: (attempt) =>
        Math.min(1000 * Math.pow(2, attempt), 10000),
      execute: async (error, context) => {
        // Implementation would go here
        return false;
      },
    });

    // Invalid Command Recovery
    this.addStrategy("INVALID_COMMAND", {
      name: "command_rephrasing",
      priority: 2,
      maxRetries: 2,
      backoffStrategy: () => 0,
      execute: async (error, context) => {
        // Implementation would go here
        return false;
      },
    });

    // Ambiguous Intent Recovery
    this.addStrategy("AMBIGUOUS_INTENT", {
      name: "context_disambiguation",
      priority: 2,
      maxRetries: 2,
      backoffStrategy: () => 0,
      execute: async (error, context) => {
        // Implementation would go here
        return false;
      },
    });

    // Missing Parameters Recovery
    this.addStrategy("MISSING_PARAMETERS", {
      name: "parameter_inference",
      priority: 2,
      maxRetries: 2,
      backoffStrategy: () => 0,
      execute: async (error, context) => {
        // Implementation would go here
        return false;
      },
    });
  }

  private addStrategy(
    errorType: ParsingErrorType,
    strategy: RecoveryStrategy
  ): void {
    if (!this.strategies.has(errorType)) {
      this.strategies.set(errorType, []);
    }
    this.strategies.get(errorType)!.push(strategy);
    this.strategies.get(errorType)!.sort((a, b) => b.priority - a.priority);
  }

  public async attemptRecovery(
    error: Error,
    context: ParsingErrorContext
  ): Promise<boolean> {
    const errorType = context.parsingErrorType;
    const strategies = this.strategies.get(errorType) || [];
    const errorKey = `${errorType}-${context.taskId || "unknown"}`;

    let retryCount = this.retryCounts.get(errorKey) || 0;
    this.retryCounts.set(errorKey, retryCount + 1);

    for (const strategy of strategies) {
      if (retryCount >= strategy.maxRetries) {
        this.logger.logError(error, {
          ...context,
          recoveryAttempt: `Max retries (${strategy.maxRetries}) exceeded for strategy ${strategy.name}`,
        });
        continue;
      }

      try {
        const delay = strategy.backoffStrategy(retryCount);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        this.logger.logError(error, {
          ...context,
          recoveryAttempt: `Attempting recovery with strategy ${
            strategy.name
          } (attempt ${retryCount + 1})`,
        });

        const success = await strategy.execute(error, context);
        if (success) {
          this.logger.logError(error, {
            ...context,
            recoveryAttempt: `Recovery successful with strategy ${strategy.name}`,
          });
          return true;
        }
      } catch (recoveryError: any) {
        this.logger.logError(recoveryError, {
          ...context,
          recoveryAttempt: `Recovery failed with strategy ${strategy.name}`,
        });
      }
    }

    return false;
  }

  public resetRetryCount(errorType: ParsingErrorType, taskId?: string): void {
    const errorKey = `${errorType}-${taskId || "unknown"}`;
    this.retryCounts.delete(errorKey);
  }
}
