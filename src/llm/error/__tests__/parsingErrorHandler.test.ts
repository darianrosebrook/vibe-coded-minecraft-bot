import { ParsingErrorHandler } from "../parsingErrorHandler";
import { ErrorHandler } from "../../../error/errorHandler";
import { TaskParsingLogger } from "../../logging/logger";
import { LLMError } from "../../../utils/llmClient";

describe("ParsingErrorHandler", () => {
  let errorHandler: ErrorHandler;
  let logger: TaskParsingLogger;
  let parsingErrorHandler: ParsingErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler({} as any);
    logger = new TaskParsingLogger();
    parsingErrorHandler = new ParsingErrorHandler(errorHandler, logger);
  });

  describe("categorizeParsingError", () => {
    it("should categorize LLM errors correctly", () => {
      const error = new LLMError("Service unavailable", "SERVICE_ERROR");
      const category = parsingErrorHandler.categorizeParsingError(error);
      expect(category).toBe("LLM_SERVICE_ERROR");
    });

    it("should categorize invalid command errors", () => {
      const error = new Error("Invalid command format");
      const category = parsingErrorHandler.categorizeParsingError(error);
      expect(category).toBe("INVALID_COMMAND");
    });

    it("should categorize ambiguous intent errors", () => {
      const error = new Error("Command has multiple possible meanings");
      const category = parsingErrorHandler.categorizeParsingError(error);
      expect(category).toBe("AMBIGUOUS_INTENT");
    });

    it("should categorize missing parameter errors", () => {
      const error = new Error("Missing required parameter: blockType");
      const category = parsingErrorHandler.categorizeParsingError(error);
      expect(category).toBe("MISSING_PARAMETERS");
    });
  });

  describe("determineParsingSeverity", () => {
    it("should return CRITICAL for LLM service errors", () => {
      const severity =
        parsingErrorHandler.determineParsingSeverity("LLM_SERVICE_ERROR");
      expect(severity).toBe("CRITICAL");
    });

    it("should return HIGH for parsing and validation errors", () => {
      const severity = parsingErrorHandler.determineParsingSeverity(
        "RESPONSE_PARSING_ERROR"
      );
      expect(severity).toBe("HIGH");
    });

    it("should return MEDIUM for invalid command errors", () => {
      const severity =
        parsingErrorHandler.determineParsingSeverity("INVALID_COMMAND");
      expect(severity).toBe("MEDIUM");
    });

    it("should return LOW for missing parameters", () => {
      const severity =
        parsingErrorHandler.determineParsingSeverity("MISSING_PARAMETERS");
      expect(severity).toBe("LOW");
    });
  });

  describe("createUserFriendlyMessage", () => {
    it("should create appropriate message for invalid commands", () => {
      const error = new Error("Invalid command format");
      const context = {
        category: "LLM",
        severity: "MEDIUM",
        taskId: "test-task",
        taskType: "mining",
        timestamp: Date.now(),
        retryCount: 0,
        error,
        parsingErrorType: "INVALID_COMMAND",
        command: "mine diamond",
      };

      const message = parsingErrorHandler.getUserFriendlyMessage({
        error,
        parsingErrorType: "INVALID_COMMAND",
        category: "LLM",
        severity: "MEDIUM",
        taskId: "test-task",
        taskType: "mining",
        timestamp: Date.now(),
        retryCount: 0,
        command: "mine diamond"
      });
      expect(message).toContain("Command Not Recognized");
      expect(message).toContain("understand your command");
      expect(message.split("\n").filter(line => line.startsWith("- "))).toHaveLength(3);
    });

    it("should create appropriate message for ambiguous intent", () => {
      const error = new Error("Multiple possible meanings");
      const context = {
        category: "LLM",
        severity: "MEDIUM",
        taskId: "test-task",
        taskType: "mining",
        timestamp: Date.now(),
        retryCount: 0,
        error,
        parsingErrorType: "AMBIGUOUS_INTENT",
        command: "mine",
      };

      const message = parsingErrorHandler.getUserFriendlyMessage({
        error,
        parsingErrorType: "AMBIGUOUS_INTENT",
        category: "LLM",
        severity: "MEDIUM",
        taskId: "test-task",
        taskType: "mining",
        timestamp: Date.now(),
        retryCount: 0,
        command: "mine"
      });
      expect(message).toContain("Unclear Command");
      expect(message).toContain("multiple things");
      expect(message.split("\n").filter(line => line.startsWith("- "))).toHaveLength(3);
    });

    it("should create appropriate message for service errors", () => {
      const error = new LLMError("Service unavailable", "SERVICE_ERROR");
      const context = {
        category: "LLM",
        severity: "CRITICAL",
        taskId: "test-task",
        taskType: "system",
        timestamp: Date.now(),
        retryCount: 0,
        error,
        parsingErrorType: "LLM_SERVICE_ERROR",
      };

      const message = parsingErrorHandler.getUserFriendlyMessage({
        error,
        parsingErrorType: "LLM_SERVICE_ERROR",
        category: "LLM",
        severity: "CRITICAL",
        taskId: "test-task",
        taskType: "system",
        timestamp: Date.now(),
        retryCount: 0,
      });
      expect(message).toContain("Service Error");
      expect(message).toContain("trouble processing");
      expect(message).toContain("SERVICE_ERROR");
    });
  });

  describe("handleParsingError", () => {
    it("should log errors and attempt recovery", async () => {
      const error = new Error("Test error");
      const context = {
        category: "LLM" as const,
        severity: "MEDIUM" as const,
        taskId: "test-task",
        taskType: "mining",
        timestamp: Date.now(),
        retryCount: 0,
        error,
        parsingErrorType: "INVALID_COMMAND" as const,
        command: "mine diamond",
      };

      const logErrorSpy = jest.spyOn(logger, "logError");
      const handleErrorSpy = jest.spyOn(errorHandler, "handleError");

      await parsingErrorHandler.handleParsingError(error, context);

      expect(logErrorSpy).toHaveBeenCalledWith(error, context);
      expect(handleErrorSpy).toHaveBeenCalledWith(error, context);
    });
  });
});
