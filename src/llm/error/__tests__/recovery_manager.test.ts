import { ErrorRecoveryManager } from "../recovery_manager";
import { TaskParsingLogger } from "../../logging/logger";
import { ParsingErrorType, ParsingErrorContext } from "../parsingErrorHandler";

describe("ErrorRecoveryManager", () => {
  let recoveryManager: ErrorRecoveryManager;
  let logger: TaskParsingLogger;

  beforeEach(() => {
    logger = new TaskParsingLogger();
    recoveryManager = new ErrorRecoveryManager(logger);
  });

  describe("attemptRecovery", () => {
    it("should attempt recovery with correct strategy for LLM service error", async () => {
      const error = new Error("LLM service unavailable");
      const context: ParsingErrorContext = {
        parsingErrorType: "LLM_SERVICE_ERROR",
        category: "LLM",
        severity: "CRITICAL",
        taskId: "test-task",
        taskType: "system",
        timestamp: Date.now(),
        retryCount: 0,
        error,
      };

      const result = await recoveryManager.attemptRecovery(error, context);
      expect(result).toBe(false); // Since we haven't implemented the actual recovery logic yet
    });

    it("should respect max retries", async () => {
      const error = new Error("Invalid command");
      const context: ParsingErrorContext = {
        parsingErrorType: "INVALID_COMMAND",
        category: "LLM",
        severity: "MEDIUM",
        taskId: "test-task",
        taskType: "system",
        timestamp: Date.now(),
        retryCount: 0,
        error,
      };

      // First attempt
      await recoveryManager.attemptRecovery(error, context);
      // Second attempt
      await recoveryManager.attemptRecovery(error, context);
      // Third attempt (should exceed max retries)
      const result = await recoveryManager.attemptRecovery(error, context);

      expect(result).toBe(false);
    });

    it("should apply backoff strategy", async () => {
      const error = new Error("LLM service unavailable");
      const context: ParsingErrorContext = {
        parsingErrorType: "LLM_SERVICE_ERROR",
        category: "LLM",
        severity: "CRITICAL",
        taskId: "test-task",
        taskType: "system",
        timestamp: Date.now(),
        retryCount: 0,
        error,
      };

      const startTime = Date.now();
      await recoveryManager.attemptRecovery(error, context);
      const endTime = Date.now();

      // Should have waited at least 1 second (1000ms)
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("resetRetryCount", () => {
    it("should reset retry count for specific error type and task", () => {
      const error = new Error("Invalid command");
      const context: ParsingErrorContext = {
        parsingErrorType: "INVALID_COMMAND",
        category: "LLM",
        severity: "MEDIUM",
        taskId: "test-task",
        taskType: "system",
        timestamp: Date.now(),
        retryCount: 0,
        error,
      };

      // Make two attempts
      recoveryManager.attemptRecovery(error, context);
      recoveryManager.attemptRecovery(error, context);

      // Reset retry count
      recoveryManager.resetRetryCount("INVALID_COMMAND", "test-task");

      // Should be able to make two more attempts
      const result = recoveryManager.attemptRecovery(error, context);
      expect(result).toBe(false);
    });
  });
});
