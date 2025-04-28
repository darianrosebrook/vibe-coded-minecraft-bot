import { ParsingErrorType } from "./parsingErrorHandler";
import { Task } from "@/types/task";

interface ErrorMessageTemplate {
  title: string;
  message: string;
  suggestions?: string[];
  details?: string;
}

interface ErrorMessageContext {
  command?: string;
  task?: Partial<Task>;
  validationErrors?: string[];
  llmResponse?: string;
}

export class ErrorMessageFormatter {
  private static readonly templates: Record<
    ParsingErrorType,
    ErrorMessageTemplate
  > = {
    INVALID_COMMAND: {
      title: "Command Not Recognized",
      message: "I couldn't understand your command. Please try rephrasing it.",
      suggestions: [
        "Check for typos or missing words",
        "Use simpler language",
        "Follow the command format: .bot [action] [parameters]",
      ],
    },
    AMBIGUOUS_INTENT: {
      title: "Unclear Command",
      message:
        "Your command could mean multiple things. Please be more specific.",
      suggestions: [
        "Specify which action you want to perform",
        "Add more details about what you want to do",
        "Use more specific terms",
      ],
    },
    MISSING_PARAMETERS: {
      title: "Missing Information",
      message: "Your command is missing some required information.",
      suggestions: [
        "Specify all necessary parameters",
        "Check if you provided all required details",
        "Try using the complete command format",
      ],
    },
    UNSUPPORTED_ACTION: {
      title: "Action Not Supported",
      message: "I can't perform that action right now.",
      suggestions: [
        "Try a different approach",
        "Check what actions are currently supported",
        "Ask for help with available commands",
      ],
    },
    CONTEXT_MISMATCH: {
      title: "Context Error",
      message: "The command doesn't match the current situation.",
      suggestions: [
        "Check your current location and inventory",
        "Verify the required conditions are met",
        "Try a different approach",
      ],
    },
    LLM_SERVICE_ERROR: {
      title: "Service Error",
      message:
        "I'm having trouble processing your command. Please try again later.",
      suggestions: [
        "Wait a few moments and try again",
        "Check if the service is available",
        "Try a simpler command",
      ],
    },
    RESPONSE_PARSING_ERROR: {
      title: "Processing Error",
      message: "I had trouble processing the response. Please try again.",
      suggestions: [
        "Try rephrasing your command",
        "Use simpler language",
        "Wait a moment and try again",
      ],
    },
    SCHEMA_VALIDATION_ERROR: {
      title: "Validation Error",
      message: "The command couldn't be validated properly.",
      suggestions: [
        "Check the command format",
        "Verify all parameters are correct",
        "Try using the standard command format",
      ],
    },
  };

  public static formatMessage(
    errorType: ParsingErrorType,
    context: ErrorMessageContext
  ): string {
    const template = this.templates[errorType];
    let message = `[${template.title}] ${template.message}\n`;

    if (template.suggestions) {
      message += "\nSuggestions:\n";
      template.suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
    }

    if (context.validationErrors?.length) {
      message += "\nValidation Errors:\n";
      context.validationErrors.forEach((error, index) => {
        message += `${index + 1}. ${error}\n`;
      });
    }

    if (context.command) {
      message += `\nCommand: ${context.command}\n`;
    }

    return message;
  }

  public static getRecoverySteps(errorType: ParsingErrorType): string[] {
    const template = this.templates[errorType];
    return template.suggestions || [];
  }

  public static getDetailedExplanation(
    errorType: ParsingErrorType,
    context: ErrorMessageContext
  ): string {
    const template = this.templates[errorType];
    let explanation = `Error Type: ${errorType}\n`;
    explanation += `Title: ${template.title}\n`;
    explanation += `Message: ${template.message}\n`;

    if (context.task) {
      explanation += `\nTask Details:\n`;
      explanation += `Type: ${context.task.type}\n`;
      if (context.task.parameters) {
        explanation += `Parameters: ${JSON.stringify(
          context.task.parameters,
          null,
          2
        )}\n`;
      }
    }

    if (context.validationErrors?.length) {
      explanation += `\nValidation Errors:\n`;
      context.validationErrors.forEach((error, index) => {
        explanation += `${index + 1}. ${error}\n`;
      });
    }

    return explanation;
  }
}
