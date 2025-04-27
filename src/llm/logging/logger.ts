import { Task } from "../../tasks/types/task";
import { Logger } from "../../utils/observability/logger";
import { TaskContext, TaskParseResult } from "../types";

export class TaskParsingLogger {
  private readonly logger: Logger;
  private sequenceId: number = 0;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  public logInput(command: string, context: TaskContext): void {
    this.logger.info("Input", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "input",
      command,
      context: {
        conversationHistory: context.conversationHistory,
        worldState: context.worldState,
        recentTasks: context.recentTasks,
        pluginContext: context.pluginContext,
      },
    });
  }

  public logLLMResponse(response: string): void {
    this.logger.info("LLM Response", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "llm_response",
      response,
    });
  }

  public logTaskResolution(task: Task | TaskParseResult): void {
    this.logger.info("Task Resolution", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "task_resolution",
      task: {
        type: task.type,
        parameters: task.parameters,
      },
    });
  }

  public logTypeOverride(originalType: string, newType: string): void {
    this.logger.info("Type Override", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "type_override",
      originalType,
      newType,
    });
  }

  public logTypeFallback(originalType: string, fallbackType: string): void {
    this.logger.info("Type Fallback", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "type_fallback",
      originalType,
      fallbackType,
    });
  }

  public logParameterValidation(
    task: Task,
    isValid: boolean,
    errors?: string[]
  ): void {
    this.logger.info("Parameter Validation", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "parameter_validation",
      task: {
        type: task.type,
        parameters: task.parameters,
      },
      isValid,
      errors,
    });
  }

  public logSubTypeValidationFailure(
    type: string,
    subType: string,
    errors?: string[]
  ): void {
    this.logger.info("Sub-Type Validation Failure", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "sub_type_validation_failure",
      taskType: type,
      subType,
      errors,
    });
  }

  public logTaskQueueUpdate(
    task: Task,
    action: "add" | "remove" | "update"
  ): void {
    this.logger.info("Task Queue Update", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "task_queue_update",
      action,
      task: {
        type: task.type,
        parameters: task.parameters,
      },
    });
  }

  public logOutput(response: string): void {
    this.logger.info("Output", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "output",
      response,
    });
  }

  public logError(error: Error, context?: any): void {
    this.logger.error("Error", {
      sequenceId: this.sequenceId,
      timestamp: new Date().toISOString(),
      type: "error",
      error: {
        message: error.message,
        stack: error.stack,
      },
      context,
    });
  }

  public logPerformance(data: {
    command: string;
    responseTime: number;
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    cacheHit: boolean;
    timestamp: number;
  }): void {
    this.logger.info("Performance", {
      sequenceId: this.sequenceId,
      type: "performance",
      ...data,
    });
  }

  public incrementSequence(): void {
    this.sequenceId++;
  }

  public getCurrentSequenceId(): number {
    return this.sequenceId;
  }
}
