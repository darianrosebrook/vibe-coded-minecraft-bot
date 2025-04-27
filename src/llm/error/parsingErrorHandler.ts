import { ErrorHandler, ErrorContext, ErrorCategory, ErrorSeverity } from '../../error/errorHandler';
import { TaskParsingLogger } from '../logging/logger';
import { LLMError } from '../../utils/llmClient';
import { Task } from '../../types/task';
import { ErrorRecoveryManager } from './recovery_manager';
import { ErrorMessageFormatter } from './message_templates';

export type ParsingErrorType = 
  | 'INVALID_COMMAND'
  | 'AMBIGUOUS_INTENT'
  | 'MISSING_PARAMETERS'
  | 'UNSUPPORTED_ACTION'
  | 'CONTEXT_MISMATCH'
  | 'LLM_SERVICE_ERROR'
  | 'RESPONSE_PARSING_ERROR'
  | 'SCHEMA_VALIDATION_ERROR';

export interface ParsingErrorContext extends ErrorContext {
  parsingErrorType: ParsingErrorType;
  command?: string;
  parsedTask?: Partial<Task>;
  llmResponse?: string;
  validationErrors?: string[];
}

export interface UserFriendlyMessage {
  title: string;
  message: string;
  suggestions?: string[];
  code?: string;
}

export class ParsingErrorHandler {
  private errorHandler: ErrorHandler;
  private logger: TaskParsingLogger;
  private recoveryManager: ErrorRecoveryManager;

  constructor(errorHandler: ErrorHandler, logger: TaskParsingLogger) {
    this.errorHandler = errorHandler;
    this.logger = logger;
    this.recoveryManager = new ErrorRecoveryManager(logger);
  }

  public async handleParsingError(error: Error, context: ParsingErrorContext): Promise<void> {
    // Log the error with detailed context
    this.logger.logError(error, {
      ...context,
      detailedExplanation: this.getDetailedExplanation(context),
      userMessage: this.getUserFriendlyMessage(context)
    });

    // Try recovery strategies
    const recoverySuccess = await this.recoveryManager.attemptRecovery(error, context);
    if (recoverySuccess) {
      return;
    }

    // If recovery fails, fall back to the base error handler
    await this.errorHandler.handleError(error, context);
  }

  public getUserFriendlyMessage(context: ParsingErrorContext): string {
    return ErrorMessageFormatter.formatMessage(context.parsingErrorType, {
      command: context.command,
      task: context.parsedTask,
      validationErrors: context.validationErrors,
      llmResponse: context.llmResponse
    });
  }

  public getDetailedExplanation(context: ParsingErrorContext): string {
    return ErrorMessageFormatter.getDetailedExplanation(context.parsingErrorType, {
      command: context.command,
      task: context.parsedTask,
      validationErrors: context.validationErrors,
      llmResponse: context.llmResponse
    });
  }

  public getRecoverySteps(errorType: ParsingErrorType): string[] {
    return ErrorMessageFormatter.getRecoverySteps(errorType);
  }

  public categorizeParsingError(error: Error): ParsingErrorType {
    if (error instanceof LLMError) {
      return 'LLM_SERVICE_ERROR';
    }

    const message = error.message.toLowerCase();
    
    if (message.includes('invalid') || message.includes('not recognized')) {
      return 'INVALID_COMMAND';
    }
    if (message.includes('ambiguous') || message.includes('multiple meanings')) {
      return 'AMBIGUOUS_INTENT';
    }
    if (message.includes('missing') || message.includes('required')) {
      return 'MISSING_PARAMETERS';
    }
    if (message.includes('unsupported') || message.includes('not implemented')) {
      return 'UNSUPPORTED_ACTION';
    }
    if (message.includes('context') || message.includes('mismatch')) {
      return 'CONTEXT_MISMATCH';
    }
    if (message.includes('parse') || message.includes('json')) {
      return 'RESPONSE_PARSING_ERROR';
    }
    if (message.includes('schema') || message.includes('validation')) {
      return 'SCHEMA_VALIDATION_ERROR';
    }

    return 'INVALID_COMMAND';
  }

  public determineParsingSeverity(errorType: ParsingErrorType): ErrorSeverity {
    switch (errorType) {
      case 'LLM_SERVICE_ERROR':
        return 'CRITICAL';
      case 'INVALID_COMMAND':
      case 'AMBIGUOUS_INTENT':
        return 'MEDIUM';
      case 'MISSING_PARAMETERS':
      case 'UNSUPPORTED_ACTION':
        return 'LOW';
      case 'CONTEXT_MISMATCH':
      case 'RESPONSE_PARSING_ERROR':
      case 'SCHEMA_VALIDATION_ERROR':
        return 'HIGH';
      default:
        return 'MEDIUM';
    }
  }
} 