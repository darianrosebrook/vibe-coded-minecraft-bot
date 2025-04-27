import { TaskContext, TaskParseResult, SystemMetrics, DebugInfo, TaskParserConfig } from './types';
import { ParsingErrorHandler } from './error/handler';
import { TaskResolutionSystem } from './resolution/system';

import { ContextManager } from './context/manager';
import { PromptOptimizer } from './context/prompt_optimizer';

import { MinecraftBot } from '../bot/bot';
import { TaskParser, } from './parser/task_parser';
import { TaskTypeResolver } from './parser/type_resolver';
import { ErrorHandler } from '../error/errorHandler';
import { OllamaClient } from '../utils/llmClient';
import { ZodSchemaValidator } from '../utils/taskValidator';
import { configManager } from '../config/configManager';
import { ParsingError } from './error/handler';

export class TaskParsingSystem {
  private parser: TaskParser;
  private contextManager: ContextManager;
  private errorHandler: ParsingErrorHandler;
  private resolutionSystem: TaskResolutionSystem;
  private promptOptimizer: PromptOptimizer;
  private metrics: SystemMetrics;

  constructor() {
    const llmClient = new OllamaClient();
    const schemaValidator = new ZodSchemaValidator();
    const typeResolver = new TaskTypeResolver();
    const config = configManager.getConfig();
    const bot = new MinecraftBot({
      host: config.MINECRAFT_HOST,
      port: config.MINECRAFT_PORT,
      username: config.MINECRAFT_USERNAME,
      password: config.MINECRAFT_PASSWORD,
      version: config.MINECRAFT_VERSION
    });
    const contextManager = new ContextManager(bot.getMineflayerBot());
    const promptOptimizer = new PromptOptimizer();
    const errorHandler = new ErrorHandler(bot);
    const parserConfig: TaskParserConfig = {
      enableCaching: true,
      cacheSize: 100,
      minConfidence: 0.7,
      maxAlternatives: 3,
      enableML: true,
      timeout: 30000
    };

    this.parser = new TaskParser(
      llmClient,
      schemaValidator,
      typeResolver,
      contextManager,
      promptOptimizer,
      errorHandler,
      parserConfig
    );
    this.contextManager = contextManager;
    this.errorHandler = new ParsingErrorHandler(llmClient);
    this.resolutionSystem = new TaskResolutionSystem(llmClient);
    this.promptOptimizer = promptOptimizer;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): SystemMetrics {
    return {
      parsing: {
        totalAttempts: 0,
        successfulParses: 0,
        averageConfidence: 0,
        averageTime: 0
      },
      resolution: {
        totalAttempts: 0,
        successfulResolutions: 0,
        fallbackUsage: 0,
        averageTime: 0
      },
      errorHandling: {
        totalErrors: 0,
        recoveredErrors: 0,
        averageRecoveryTime: 0,
        errorTypes: {}
      }
    };
  }

  async parseCommand(command: string, context: TaskContext): Promise<TaskParseResult> {
    const startTime = Date.now();
    this.metrics.parsing.totalAttempts++;

    try {
      // Get optimized prompt
      const prompt = await this.promptOptimizer.generatePrompt(command, context);

      // Parse the command
      const result = await this.parser.parse(command);

      // Update metrics
      const endTime = Date.now();
      this.metrics.parsing.successfulParses++;
      this.metrics.parsing.averageConfidence = 
        (this.metrics.parsing.averageConfidence * (this.metrics.parsing.successfulParses - 1) + result.confidence) / 
        this.metrics.parsing.successfulParses;
      this.metrics.parsing.averageTime = 
        (this.metrics.parsing.averageTime * (this.metrics.parsing.successfulParses - 1) + (endTime - startTime)) / 
        this.metrics.parsing.successfulParses;

      return {
        type: result.task.type,
        parameters: result.task.parameters,
        confidence: result.confidence,
        alternatives: result.alternatives.map(alt => ({
          type: alt.type,
          parameters: alt.parameters,
          confidence: alt.confidence
        })),
        context: result.task.context,
        pluginRequirements: []
      };
    } catch (error) {
      // Handle parsing error
      return this.handleError(error as ParsingError, context);
    }
  }

  private async handleError(error: ParsingError, context: TaskContext): Promise<TaskParseResult> {
    try {
      const recoveryStrategy = await this.errorHandler.handleError(error);
      return {
        type: 'error',
        parameters: { message: error.message },
        confidence: recoveryStrategy.confidence,
        alternatives: recoveryStrategy.steps.map(step => ({
          type: 'error',
          parameters: { message: step },
          confidence: recoveryStrategy.confidence
        })),
        context,
        pluginRequirements: []
      };
    } catch (recoveryError) {
      return {
        type: 'error',
        parameters: { message: error.message },
        confidence: 0,
        alternatives: [],
        context,
        pluginRequirements: []
      };
    }
  }

  async getDebugInfo(command: string, context: TaskContext): Promise<DebugInfo> {
    return {
      parsing: {
        input: command,
        context,
        result: undefined,
        error: undefined
      },
      resolution: {
        strategy: this.resolutionSystem.getResolutionStatistics().toString(),
        result: undefined,
        error: undefined
      },
      errorHandling: {
        error: undefined,
        strategy: undefined,
        result: undefined
      },
      metrics: this.metrics
    };
  }

  getMetrics(): SystemMetrics {
    return this.metrics;
  }

  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }
} 