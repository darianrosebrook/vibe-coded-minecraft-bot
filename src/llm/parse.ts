import { Task, TaskParameters, MiningTaskParameters, QueryTaskParameters, TaskType, TaskPriority, TaskStatus } from '@/types/task';
import { LLMClient, LLMError } from '../utils/llmClient';
import { SchemaValidator } from '../utils/taskValidator';
import { readFileSync } from 'fs';
import { join } from 'path';
 
import { TaskParsingLogger } from './logging/logger';
import { ParsingErrorHandler, ParsingErrorContext } from './error/parsingErrorHandler';
import { ErrorHandler } from '../error/errorHandler';
import { CommandCache } from './cache/commandCache';
import { PerformanceMonitor } from './monitoring/performanceMonitor';

// Map of common block names to their Minecraft IDs
const BLOCK_MAP: Record<string, string> = {
  // Wood types (most specific first)
  'acacia wood': 'acacia_log',
  'acacia log': 'acacia_log',
  'acacia': 'acacia_log',
  'dark oak wood': 'dark_oak_log',
  'dark oak log': 'dark_oak_log',
  'dark oak': 'dark_oak_log',
  'jungle wood': 'jungle_log',
  'jungle log': 'jungle_log',
  'jungle': 'jungle_log',
  'birch wood': 'birch_log',
  'birch log': 'birch_log',
  'birch': 'birch_log',
  'spruce wood': 'spruce_log',
  'spruce log': 'spruce_log',
  'spruce': 'spruce_log',
  'oak wood': 'oak_log',
  'oak log': 'oak_log',
  'oak': 'oak_log',
  'wood': 'oak_log',
  'log': 'oak_log',
  
  // Ores
  'diamond ore': 'diamond_ore',
  'diamond': 'diamond_ore',
  'emerald ore': 'emerald_ore',
  'emerald': 'emerald_ore',
  'gold ore': 'gold_ore',
  'gold': 'gold_ore',
  'iron ore': 'iron_ore',
  'iron': 'iron_ore',
  'coal ore': 'coal_ore',
  'coal': 'coal_ore',
  'redstone ore': 'redstone_ore',
  'redstone': 'redstone_ore',
  'lapis ore': 'lapis_ore',
  'lapis': 'lapis_ore',
  'quartz ore': 'nether_quartz_ore',
  'quartz': 'nether_quartz_ore',
  
  // Common blocks
  'stone': 'stone',
  'cobblestone': 'cobblestone',
  'dirt': 'dirt',
  'grass': 'grass_block',
  'sand': 'sand',
  'gravel': 'gravel'
};

export class TaskParser {
  private readonly systemPrompt: string;
  private readonly llmClient: LLMClient;
  private readonly logger: TaskParsingLogger;
  private readonly schemaValidator: SchemaValidator;
  private readonly errorHandler: ParsingErrorHandler;
  private readonly commandCache: CommandCache;
  private readonly performanceMonitor: PerformanceMonitor;

  constructor(
    llmClient: LLMClient,
    logger: TaskParsingLogger,
    schemaValidator: SchemaValidator,
    baseErrorHandler: ErrorHandler
  ) {
    this.llmClient = llmClient;
    this.logger = logger;
    this.schemaValidator = schemaValidator;
    this.errorHandler = new ParsingErrorHandler(baseErrorHandler, logger);
    this.commandCache = new CommandCache();
    this.performanceMonitor = new PerformanceMonitor();
    
    // Load all prompt files
    const promptsDir = join(__dirname, 'prompts');
    const basePrompt = readFileSync(join(promptsDir, 'parse-task.base.txt'), 'utf-8');
    const examplesPrompt = readFileSync(join(promptsDir, 'parse-task.examples.txt'), 'utf-8');
    const gatheringPrompt = readFileSync(join(promptsDir, 'parse-task.gathering.txt'), 'utf-8');
    const queryPrompt = readFileSync(join(promptsDir, 'parse-task.query.txt'), 'utf-8');
    const navigationPrompt = readFileSync(join(promptsDir, 'parse-task.navigation.txt'), 'utf-8');
    
    // Combine all prompts
    this.systemPrompt = [
      basePrompt,
      examplesPrompt,
      gatheringPrompt,
      queryPrompt,
      navigationPrompt
    ].join('\n\n');
  }

  private async ensureServiceAvailability(): Promise<void> {
    try {
      await this.llmClient.checkAvailability();
    } catch (error) {
      const context: ParsingErrorContext = {
        category: 'LLM',
        severity: 'CRITICAL',
        taskId: '',
        taskType: 'system',
        timestamp: Date.now(),
        retryCount: 0,
        error: error as Error,
        parsingErrorType: 'LLM_SERVICE_ERROR'
      };
      
      await this.errorHandler.handleParsingError(error as Error, context);
      throw error;
    }
  }

  private async generateResponse(prompt: string): Promise<string> {
    try {
      return await this.llmClient.generate(prompt);
    } catch (error) {
      const context: ParsingErrorContext = {
        category: 'LLM',
        severity: 'HIGH',
        taskId: '',
        taskType: 'system',
        timestamp: Date.now(),
        retryCount: 0,
        error: error as Error,
        parsingErrorType: 'LLM_SERVICE_ERROR'
      };
      
      await this.errorHandler.handleParsingError(error as Error, context);
      throw error;
    }
  }

  private async parseResponse(response: string): Promise<Task> {
    try {
      // First try to find JSON content within markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        const jsonContent = jsonMatch[1].trim();
        try {
          return JSON.parse(jsonContent);
        } catch (e) {
          // If parsing fails, try to clean the content
          const cleanedContent = jsonContent.replace(/[\n\r]/g, '').trim();
          return JSON.parse(cleanedContent);
        }
      }
      
      // If no markdown code blocks, try to find Python-formatted JSON
      const pythonMatch = response.match(/```python\n?([\s\S]*?)\n?```/);
      if (pythonMatch) {
        const pythonContent = pythonMatch[1].trim();
        // Convert Python dict to JSON
        const jsonContent = pythonContent
          .replace(/'/g, '"')  // Replace single quotes with double quotes
          .replace(/True/g, 'true')  // Convert Python boolean to JSON
          .replace(/False/g, 'false')
          .replace(/None/g, 'null');  // Convert Python None to JSON null
        try {
          return JSON.parse(jsonContent);
        } catch (e) {
          // If parsing fails, try to clean the content
          const cleanedContent = jsonContent.replace(/[\n\r]/g, '').trim();
          return JSON.parse(cleanedContent);
        }
      }
      
      // If no code blocks, try to find JSON object directly
      const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        const jsonContent = jsonObjectMatch[0].trim();
        try {
          return JSON.parse(jsonContent);
        } catch (e) {
          // If parsing fails, try to clean the content
          const cleanedContent = jsonContent.replace(/[\n\r]/g, '').trim();
          return JSON.parse(cleanedContent);
        }
      }
      
      // If no JSON found, try parsing the entire response
      return JSON.parse(response.trim());
    } catch (error) {
      const context: ParsingErrorContext = {
        category: 'LLM',
        severity: 'HIGH',
        taskId: '',
        taskType: 'system',
        timestamp: Date.now(),
        retryCount: 0,
        error: error as Error,
        parsingErrorType: 'RESPONSE_PARSING_ERROR',
        llmResponse: response
      };
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new LLMError(`Failed to parse task from LLM response: ${errorMessage}`, 'INVALID_TASK_FORMAT');
    }
  }

  private detectBlockType(description: string): string | undefined {
    const lowerDesc = description.toLowerCase();
    // Sort entries by length (longest first) to prioritize more specific matches
    const sortedEntries = Object.entries(BLOCK_MAP).sort((a, b) => b[0].length - a[0].length);
    
    for (const [name, blockId] of sortedEntries) {
      // Check for exact word match to avoid partial matches like "acacia" in "acacia wood"
      const words = lowerDesc.split(/\s+/);
      if (words.some(word => word === name) || lowerDesc.includes(name)) {
        this.logger.debug('Matched block type', {
          description: lowerDesc,
          matchedName: name,
          blockId
        });
        return blockId;
      }
    }
    return undefined;
  }

  private handleInventoryQuery(task: Task, description: string): Task {
    const inventoryKeywords = ['inventory', 'items', 'have', 'carry', 'pickaxe', 'axe', 'sword', 'shovel', 'hoe', 'armor', 'food', 'wood', 'stone', 'iron', 'gold', 'diamond'];
    const isInventoryQuery = inventoryKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );

    if (isInventoryQuery && task.type !== 'query') {
      this.logger.warn('Inventory query detected but wrong task type returned', {
        command: description,
        returnedType: task.type,
        expectedType: 'query'
      });

      // Extract item type from description
      const itemType = this.extractItemType(description);

      return {
        id: `task-${Date.now()}`,
        type: TaskType.QUERY,
        parameters: {
          queryType: 'inventory',
          filters: itemType ? {
            itemType: itemType
          } : undefined
        } as QueryTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return task;
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

  private handleNavigationCommand(task: Task, description: string): Task {
    const navigationKeywords = ['come here', 'follow me', 'come to me', 'find me'];
    const isNavigationCommand = navigationKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );

    if (isNavigationCommand && task.type !== 'navigation') {
      this.logger.warn('Navigation command detected but wrong task type returned', {
        command: description,
        returnedType: task.type,
        expectedType: 'navigation'
      });
      return {
        id: `task-${Date.now()}`,
        type: TaskType.NAVIGATION,
        parameters: {} as TaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return task;
  }

  private handleQueryCommand(task: Task, description: string): Task {
    const queryKeywords = ['where are you', 'what is your', 'how many', 'do you have', 'what do you have'];
    const isQueryCommand = queryKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );

    if (isQueryCommand && task.type !== 'query') {
      this.logger.warn('Query command detected but wrong task type returned', {
        command: description,
        returnedType: task.type,
        expectedType: 'query'
      });

      let queryType = 'status';
      if (description.toLowerCase().includes('where are you')) {
        queryType = 'position';
      } else if (description.toLowerCase().includes('how many') || description.toLowerCase().includes('do you have')) {
        queryType = 'inventory';
      } else if (description.toLowerCase().includes('what is nearby')) {
        queryType = 'nearby';
      }

      return {
        id: `task-${Date.now()}`,
        type: TaskType.QUERY,
        parameters: {
          queryType: queryType
        } as QueryTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return task;
  }

  private handleCraftingCommand(task: Task, description: string): Task {
    const craftingKeywords = ['create', 'make', 'craft', 'build'];
    const toolKeywords = ['pickaxe', 'axe', 'sword', 'shovel', 'hoe'];
    
    const lowerDesc = description.toLowerCase();
    const isCraftingCommand = craftingKeywords.some(keyword => lowerDesc.includes(keyword)) &&
                            toolKeywords.some(keyword => lowerDesc.includes(keyword));

    if (isCraftingCommand && task.type !== 'crafting') {
      this.logger.warn('Crafting command detected but wrong task type returned', {
        command: description,
        returnedType: task.type,
        expectedType: 'crafting'
      });
      return {
        id: `task-${Date.now()}`,
        type: TaskType.CRAFTING,
        parameters: {
          itemType: toolKeywords.find(keyword => lowerDesc.includes(keyword)) || 'pickaxe',
          quantity: 1
        } as TaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return task;
  }

  private handleMiningCommand(task: Task, description: string): Task {
    if (task.type === 'mining') {
      const miningParams = task.parameters as MiningTaskParameters;
      if (!miningParams.block) {
        const blockType = this.detectBlockType(description);
        if (blockType) {
          this.logger.info('Detected block type from description', {
            description,
            blockType
          });
          return {
            ...task,
            parameters: {
              ...miningParams,
              block: blockType
            } as MiningTaskParameters
          };
        }
      }
    } else if (this.detectBlockType(description)) {
      // If we detect a block type but got a different task type, convert to mining
      this.logger.info('Converting task to mining based on block detection', {
        originalType: task.type,
        description
      });
      return {
        id: `task-${Date.now()}`,
        type: TaskType.MINING,
        parameters: {
          block: this.detectBlockType(description)!
        } as MiningTaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    return task;
  }

  private handleGatheringCommand(task: Task, description: string): Task {
    const gatheringKeywords = ['pass', 'give', 'get', 'collect', 'gather', 'bring'];
    const isGatheringCommand = gatheringKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );

    if (isGatheringCommand && task.type !== 'gathering') {
      this.logger.warn('Gathering command detected but wrong task type returned', {
        command: description,
        returnedType: task.type,
        expectedType: 'gathering'
      });

      // Extract item type and quantity from description
      const itemType = this.extractItemType(description);
      const quantity = this.extractQuantity(description);

      return {
        id: `task-${Date.now()}`,
        type: TaskType.GATHERING,
        parameters: {
          itemType: itemType || 'unknown',
          quantity: quantity || 1
        } as TaskParameters,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return task;
  }

  private extractQuantity(description: string): number | undefined {
    const quantityMatch = description.match(/\d+/);
    return quantityMatch ? parseInt(quantityMatch[0]) : undefined;
  }

  public async parse(description: string, playerName?: string): Promise<Task> {
    const startTime = this.performanceMonitor.startRequest(description);

    try {
      // Check cache first
      const cachedTask = this.commandCache.get(description);
      if (cachedTask) {
        this.logger.info('Cache hit', {
          command: description,
          cachedTask: {
            type: cachedTask.type,
            parameters: cachedTask.parameters
          }
        });
        this.performanceMonitor.endRequest(startTime, description, undefined, true);
        return cachedTask;
      }

      // Layer 1: Connectivity and Model Availability
      await this.ensureServiceAvailability();
      this.logger.info('LLM service available', { command: description });

      // Layer 2: Response Generation
      const prompt = `${this.systemPrompt}\n\nCommand: ${description}${playerName ? `\nPlayer name: ${playerName}` : ''}`;
      this.logger.info('Generating LLM response', { 
        command: description,
        promptLength: prompt.length
      });
      
      const response = await this.generateResponse(prompt);
      this.logger.info('LLM response received', { 
        command: description,
        responseLength: response.length,
        response
      });

      // Layer 3: JSON Parsing
      const task = await this.parseResponse(response);
      this.logger.info('Task parsed', {
        command: description,
        task: {
          type: task.type,
          parameters: task.parameters
        }
      });

      // Handle different command types
      const processedTask = this.handleQueryCommand(
        this.handleInventoryQuery(
          this.handleGatheringCommand(
            this.handleCraftingCommand(
              this.handleMiningCommand(task, description),
              description
            ),
            description
          ),
          description
        ),
        description
      );

      // Layer 4: Schema Validation
      try {
        this.schemaValidator.validate(processedTask);
        this.logger.info('Task validated', {
          command: description,
          taskType: processedTask.type
        });
      } catch (error) {
        this.logger.error('Task validation failed', {
          command: description,
          error: error instanceof Error ? error.message : String(error),
          task: {
            type: processedTask.type,
            parameters: processedTask.parameters
          }
        });
        throw error;
      }

      // Cache the result
      this.commandCache.set(description, processedTask);

      // Update performance metrics
      this.performanceMonitor.endRequest(startTime, description, undefined);
      return processedTask;
    } catch (error) {
      this.performanceMonitor.recordError();
      this.logger.error('Task parsing failed', {
        command: description,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      if (error instanceof LLMError) {
        throw error;
      }

      const context: ParsingErrorContext = {
        category: 'LLM',
        severity: 'HIGH',
        taskId: '',
        taskType: 'unknown',
        timestamp: Date.now(),
        retryCount: 0,
        error: error as Error,
        parsingErrorType: this.errorHandler.categorizeParsingError(error as Error),
        command: description
      };

      await this.errorHandler.handleParsingError(error as Error, context);
      throw error;
    }
  }

  public getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics();
  }

  public getCacheMetrics() {
    return {
      hitRate: this.commandCache.getHitRate(),
      size: this.commandCache.getCacheSize(),
      metrics: this.commandCache.getMetrics()
    };
  }

  public clearCache(): void {
    this.commandCache.clear();
    this.logger.info('Command cache cleared');
  }
}

// For backward compatibility
import { OllamaClient } from '../utils/llmClient';
import { ZodSchemaValidator } from '../utils/taskValidator';
import { MinecraftBot } from '../bot/bot';

let defaultParser: TaskParser | null = null;

export const initializeParser = (bot: MinecraftBot) => {
  defaultParser = new TaskParser(
    new OllamaClient(),
    new TaskParsingLogger(),
    new ZodSchemaValidator(),
    new ErrorHandler(bot)
  );
};

export const parseTask = (description: string, playerName?: string) => {
  if (!defaultParser) {
    throw new Error('Parser not initialized. Call initializeParser first.');
  }
  return defaultParser.parse(description, playerName);
}; 