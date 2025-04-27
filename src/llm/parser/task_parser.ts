import { Task as LLMTask, TaskType, TaskPriority, TaskStatus, TaskParameters, QueryTaskParameters } from '../../types/task';
import { Task } from '../../tasks/types/task';
import { LLMClient, LLMError } from '../../utils/llmClient';
import { SchemaValidator } from '../../utils/taskValidator';
import { Logger } from '../../utils/observability/logger'; 
import { ContextManager } from '../context/manager'; 
import { TaskParsingLogger } from '../logging/logger';
import { ParameterValidator } from './parameter_validator';
import { TaskParseResult, ParsingMetrics, ParsingError, ParsingResult, TaskParserConfig, TaskContext } from '../types'; 
import { ErrorHandler } from '../../error/errorHandler';
import { SemanticMatcher } from './ml/semanticMatcher';
import { CommandCache } from '../cache/commandCache';
import { MLIntentClassifier } from './ml/intentClassifier';
import { PerformanceMonitor } from '../monitoring/performanceMonitor';
import { PatternRecognizer } from './ml/patternRecognizer';
import { TaskTypeResolver } from './type_resolver';
import { PromptOptimizer } from '../context/prompt_optimizer';
import { GameState } from '../context/manager';

export class TaskParser {
  private readonly logger: TaskParsingLogger;
  private readonly parameterValidator: ParameterValidator;
  private readonly errorHandler: ErrorHandler;
  private readonly commandCache: CommandCache;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly intentClassifier: MLIntentClassifier;
  private readonly semanticMatcher: SemanticMatcher;
  private readonly patternRecognizer: PatternRecognizer;
  private readonly config: TaskParserConfig;
  private metrics: ParsingMetrics;

  constructor(
    private readonly llmClient: LLMClient,
    private readonly schemaValidator: SchemaValidator,
    private readonly typeResolver: TaskTypeResolver,
    private readonly contextManager: ContextManager,
    private readonly promptOptimizer: PromptOptimizer,
    errorHandler: ErrorHandler,
    config: TaskParserConfig,
    logger?: Logger,
  ) {
    this.logger = new TaskParsingLogger(logger);
    this.parameterValidator = new ParameterValidator();
    this.errorHandler = errorHandler;
    this.config = config;
    this.commandCache = new CommandCache(config.cacheSize);
    this.performanceMonitor = new PerformanceMonitor();
    this.intentClassifier = new MLIntentClassifier();
    this.semanticMatcher = new SemanticMatcher();
    this.patternRecognizer = new PatternRecognizer();
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): ParsingMetrics {
    return {
      totalAttempts: 0,
      successfulParses: 0,
      averageConfidence: 0,
      averageTime: 0,
      errorCount: 0,
      tokenUsage: 0
    };
  }

  private convertGameStateToTaskContext(gameState: GameState): TaskContext {
    if (!gameState) {
      throw new Error('GameState is required');
    }
    
    return {
      bot: this.contextManager.getBot(),
      pluginContext: {},
      conversationHistory: [],
      worldState: {
        inventory: {
          hasTool: (tool: string) => false,
          hasMaterials: (materials: string[]) => false,
          hasSpace: () => true,
          items: []
        },
        position: gameState.position || { x: 0, y: 0, z: 0 },
        surroundings: gameState.nearbyBlocks || [],
        time: gameState.timeOfDay || 0
      },
      recentTasks: [],
      currentTask: undefined,
      botState: {
        health: gameState.health || 20,
        hunger: gameState.food || 20,
        position: gameState.position || { x: 0, y: 0, z: 0 }
      }
    };
  }

  private convertTaskParseResultToTask(taskParseResult: TaskParseResult): Task {
    return {
      id: `task-${Date.now()}`,
      type: taskParseResult.type,
      parameters: taskParseResult.parameters as TaskParameters,
      priority: TaskPriority.MEDIUM, // Default to medium priority (50)
      data: {},
      progress: 0
    };
  }
  

  private convertToLLMTask(task: Task): LLMTask {
    return {
      id: task.id,
      type: task.type as TaskType,
      parameters: task.parameters as TaskParameters,
      priority: task.priority ?? TaskPriority.MEDIUM, // Default to medium priority (50)
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: task.data || {}
    };
  }

  private convertToTaskParseResult(task: Task): TaskParseResult {
    return {
      type: task.type,
      parameters: task.parameters as TaskParameters,
      confidence: 1.0,
      alternatives: [],
      context: {
        bot: this.contextManager.getBot(),
        conversationHistory: [],
        worldState: {
          inventory: {
            hasTool: () => false,
            hasMaterials: () => false,
            hasSpace: () => true,
            items: []
          },
          position: { x: 0, y: 0, z: 0 },
          surroundings: [],
          time: 0
        },
        recentTasks: [],
        pluginContext: {}
      },
      pluginRequirements: []
    };
  }

  private extractItemType(description: string): string | undefined {
    const itemKeywords = ['wood', 'stone', 'iron', 'gold', 'diamond', 'pickaxe', 'axe', 'sword', 'shovel', 'hoe', 'armor', 'food'];
    const lowerDesc = description.toLowerCase();
    
    for (const keyword of itemKeywords) {
      if (lowerDesc.includes(keyword)) {
        return keyword;
      }
    }
    return undefined;
  }

  public async parse(command: string, playerName?: string): Promise<ParsingResult> {
    const startTime = Date.now();
    this.metrics.totalAttempts++;
    let context: TaskContext | undefined;

    try {
      // Get current context
      const gameState = await this.contextManager.getGameState();
      context = this.convertGameStateToTaskContext(gameState);

      // Check cache if enabled
      if (this.config.enableCaching) {
        const cachedResult = this.commandCache.get(command);
        if (cachedResult) {
          const taskParseResult: TaskParseResult = {
            type: cachedResult.type,
            parameters: cachedResult.parameters as TaskParameters,
            confidence: 1.0,
            alternatives: [],
            context: context,
            pluginRequirements: []
          };
          return {
            task: taskParseResult,
            confidence: 1.0,
            alternatives: [],
            metrics: this.metrics,
            debugInfo: {
              intent: 'cached',
              semanticScore: 1.0,
              patternMatch: true,
              validationSteps: ['cache_hit']
            }
          };
        }
      }

      // ML-based intent classification
      const intent = await this.intentClassifier.classify(command);
      
      // Semantic similarity matching
      const semanticScore = await this.semanticMatcher.getSimilarity(command, context);
      
      // Pattern recognition
      const patternMatch = await this.patternRecognizer.recognize(command);

      // Generate optimized prompt
      const prompt = await this.promptOptimizer.generatePrompt(command, context);
      this.logger.logInput(command, context);

      // Get LLM response
      const response = await this.llmClient.generate(prompt);
      this.logger.logLLMResponse(response);

      // Parse and validate response
      const task = this.parseResponse(response);
      
      // Handle query tasks specifically
      if (task.type === 'query') {
        const queryParams = task.parameters as QueryTaskParameters;
        if (queryParams.queryType === 'inventory') {
          // Extract item type from command
          const itemType = this.extractItemType(command);
          if (itemType) {
            queryParams.filters = {
              type: itemType
            };
          }
        }
      }
      
      this.schemaValidator.validate(task);
      this.logger.logTaskResolution(this.convertTaskParseResultToTask(task));

      // Resolve task type with context
      const resolvedTask = await this.typeResolver.resolve(this.convertToLLMTask(this.convertTaskParseResultToTask(task)), context);
      const taskForLogging = this.convertToTaskParseResult(resolvedTask);
      this.logger.logTaskResolution(taskForLogging);

      // Validate parameters using the new ParameterValidator
      const validationResult = await this.parameterValidator.validateParameters(
        resolvedTask.type,
        resolvedTask.parameters,
        context
      );

      if (!validationResult.isValid) {
        this.logger.logParameterValidation(resolvedTask, !validationResult.isValid);
        throw new Error(`Parameter validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Update task with validated parameters
      const validatedTask = {
        ...resolvedTask,
        parameters: validationResult.validatedParameters
      };

      // Update context with new task
      this.contextManager.updateTaskHistory({
        type: validatedTask.type,
        parameters: validatedTask.parameters,
        status: 'in_progress',
        timestamp: Date.now()
      });

      // Calculate confidence
      const taskParseResult = this.convertToTaskParseResult(validatedTask as unknown as Task);
      const confidence = this.calculateConfidence(taskParseResult, intent, semanticScore, patternMatch);

      // Generate alternatives based on different strategies
      const alternatives = await this.generateAlternatives(taskParseResult, context);

      // Update metrics
      const endTime = Date.now();
      this.updateMetrics(endTime - startTime, confidence);

      const result: ParsingResult = {
        task: taskParseResult,
        confidence,
        alternatives,
        metrics: this.metrics,
        debugInfo: {
          intent,
          semanticScore,
          patternMatch,
          validationSteps: ['intent_classification', 'semantic_matching', 'pattern_recognition', 'task_generation', 'validation']
        }
      };

      // Cache result if enabled
      if (this.config.enableCaching) {
        const taskToCache: LLMTask = {
          id: `task-${Date.now()}`,
          type: result.task.type as TaskType,
          parameters: result.task.parameters as TaskParameters,
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {}, 
        };
        this.commandCache.set(command, taskToCache);
      }

      this.logger.logTaskResolution(result.task);
      return result;
    } catch (error) {
      this.metrics.errorCount++;
      if (!context) {
        throw new Error('Context is required for error handling');
      }
      throw this.handleError(error as Error, command, context);
    }
  }

  private parseResponse(response: string): TaskParseResult {
    try {
      const task = JSON.parse(response) as TaskParseResult;
      return task;
    } catch (error) {
      throw new LLMError(
        'Failed to parse task from LLM response',
        'INVALID_TASK_FORMAT'
      );
    }
  }

  private calculateConfidence(
    task: TaskParseResult,
    intent: string,
    semanticScore: number,
    patternMatch: boolean
  ): number {
    // Base confidence from task
    const baseConfidence = task.confidence || 0.5;
    
    // Adjust based on ML components
    const intentConfidence = this.intentClassifier.getConfidence(intent);
    const semanticConfidence = semanticScore;
    const patternConfidence = patternMatch ? 0.9 : 0.5;
    
    // Weighted average
    return (baseConfidence * 0.4 + intentConfidence * 0.2 + semanticConfidence * 0.2 + patternConfidence * 0.2);
  }

  private async generateAlternatives(task: TaskParseResult, context: TaskContext): Promise<TaskParseResult[]> {
    const alternatives: TaskParseResult[] = [];
    const maxAlternatives = this.config.maxAlternatives;

    // Generate alternatives based on different strategies
    if (alternatives.length < maxAlternatives) {
      const alternative = { ...task, confidence: task.confidence * 0.8 };
      alternatives.push(alternative);
    }

    return alternatives;
  }

  private handleError(error: Error, command: string, context: TaskContext): ParsingError {
    const parsingError: ParsingError = {
      type: this.determineErrorType(error),
      message: error.message,
      context,
      recoveryStrategy: this.determineRecoveryStrategy(error)
    };
    const errorContext = {
      category: 'LLM' as const,
      severity: 'HIGH' as const,
      taskId: parsingError.context?.recentTasks[0]?.type || 'unknown',
      taskType: parsingError.context?.recentTasks[0]?.type || 'unknown',
      timestamp: Date.now(),
      retryCount: 0,
      error: error,
      metadata: context
    };
    this.errorHandler.handleError(error, errorContext);
    return parsingError;
  }

  private determineErrorType(error: Error): ParsingError['type'] {
    if (error.message.includes('type')) return 'type_mismatch';
    if (error.message.includes('parameter')) return 'parameter_invalid';
    if (error.message.includes('context')) return 'context_missing';
    return 'ambiguous';
  }

  private determineRecoveryStrategy(error: Error): string {
    // Implement recovery strategy determination logic
    return 'retry_with_fallback';
  }

  private updateMetrics(processingTime: number, confidence: number): void {
    this.metrics.successfulParses++;
    this.metrics.averageConfidence = 
      (this.metrics.averageConfidence * (this.metrics.successfulParses - 1) + confidence) / 
      this.metrics.successfulParses;
    this.metrics.averageTime = 
      (this.metrics.averageTime * (this.metrics.successfulParses - 1) + processingTime) / 
      this.metrics.successfulParses;
  }

  public getMetrics(): ParsingMetrics {
    return this.metrics;
  }

  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }
} 