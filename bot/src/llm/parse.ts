import { CommandCache } from './cache/commandCache';
import { ErrorHandler, ErrorCategory } from '../error/errorHandler';
import { join } from 'path'; 
import { LLMClient, LLMError } from '../utils/llmClient';
import { ParsingErrorHandler, ParsingErrorContext, ParsingErrorType } from './error/parsingErrorHandler';
import { PerformanceMonitor } from './monitoring/performanceMonitor';
import { readFileSync } from 'fs';
import { SchemaValidator } from '../utils/taskValidator';
import { Task, TaskParameters, MiningTaskParameters, QueryTaskParameters, TaskType, TaskPriority, TaskStatus } from '../types/task';
import { TaskParsingLogger } from './logging/logger';

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
      // First try to parse the response directly as JSON
      try {
        const task = JSON.parse(response);
        if (this.isValidTask(task)) {
          return task;
        }
      } catch (e) {
        // If direct parsing fails, try to extract JSON from markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          const jsonContent = jsonMatch[1]?.trim() || '';
          try {
            const task = JSON.parse(jsonContent);
            if (this.isValidTask(task)) {
              return task;
            }
          } catch (innerError) {
            this.logger.warn('Failed to parse JSON from code block', {
              originalContent: jsonContent,
              error: innerError instanceof Error ? innerError.message : String(innerError)
            });
          }
        }
      }

      // If we get here, we have a non-JSON response
      // Try to convert it into a chat task
      if (response.trim().length > 0) {
        this.logger.warn('Converting non-JSON response to chat task', {
          response: response.trim()
        });

        // Check if the message contains JSON that could be a task
        try {
          const potentialTask = JSON.parse(response.trim());
          if (this.isValidTask(potentialTask)) {
            return potentialTask;
          }
        } catch (e) {
          // Not valid JSON or not a valid task, continue with chat task
        }
        
        return {
          id: `task-${Date.now()}`,
          type: TaskType.CHAT,
          parameters: {
            message: response.trim(),
            chatType: "normal",
            context: {
              lastMessage: '',
              playerName: '',
              botState: {
                position: { x: 0, y: 0, z: 0 },
                health: 20,
                food: 20,
                inventory: []
              }
            }
          },
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
      
      throw new LLMError('Empty or invalid response from LLM', 'INVALID_RESPONSE');
    } catch (error) {
      this.errorHandler.handleParsingError(error as Error, {
        command: '',
        parsingErrorType: 'RESPONSE_PARSING_ERROR',
        category: 'LLM',
        severity: 'HIGH',
        taskId: '',
        taskType: 'system',
        timestamp: Date.now(),
        retryCount: 0,
        error: error as Error
      });
      throw error;
    }
  }

  private isValidTask(task: any): task is Task {
    return (
      task &&
      typeof task === 'object' &&
      typeof task.type === 'string' &&
      typeof task.parameters === 'object' &&
      task.parameters !== null
    );
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
          queryType: 'inventory'
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
      if (!miningParams.targetBlock) {
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
          targetBlock: this.detectBlockType(description)!
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

  private generatePrompt(description: string, playerName?: string): string {
    return `${this.systemPrompt}\n\nUser: ${playerName ? `[${playerName}] ` : ''}${description}`;
  }

  public async parse(description: string, playerName?: string): Promise<Task> {
    try {
      // Check cache first
      const cachedTask = await this.commandCache.get(description);
      if (cachedTask) {
        this.logger.info('Cache hit', {
          command: description,
          task: cachedTask
        });
        return cachedTask;
      }

      // Ensure service is available
      await this.ensureServiceAvailability();

      // Generate prompt and get LLM response
      const prompt = this.generatePrompt(description, playerName);
      const response = await this.generateResponse(prompt);

      // Parse the response into a task
      let task = await this.parseResponse(response);

      // Apply command handlers in the correct order
      task = this.handleQueryCommand(task, description);
      task = this.handleInventoryQuery(task, description);
      task = this.handleNavigationCommand(task, description);
      task = this.handleCraftingCommand(task, description);
      task = this.handleMiningCommand(task, description);
      task = this.handleGatheringCommand(task, description);

      // Validate the task
      if (!this.isValidTask(task)) {
        throw new LLMError('Invalid task format', 'INVALID_TASK_FORMAT');
      }

      // Cache the task
      await this.commandCache.set(description, task);

      return task;
    } catch (error) {
      this.errorHandler.handleParsingError(error as Error, {
        command: description,
        parsingErrorType: 'INVALID_COMMAND',
        category: 'LLM',
        severity: 'HIGH',
        taskId: '',
        taskType: 'system',
        timestamp: Date.now(),
        retryCount: 0,
        error: error as Error
      });
      throw error;
    }
  }

  public getPerformanceMetrics(): { 
    totalRequests: number;
    totalTokens: number; 
    averageResponseTime: number;
    errorCount: number;
    cacheHitRate: number;
    tokenUsageByCommand: Map<string, number>;
    responseTimes: number[];
  } {
    return this.performanceMonitor.getMetrics();
  }

  public getCacheMetrics(): { 
    hitRate: number;
    size: number;
    metrics: {
      hits: number;
      misses: number;
      evictions: number;
      averageResponseTime: number;
      totalCommands: number;
    }
  } {
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