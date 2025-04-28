import { LLMClient, LLMError } from '../utils/llmClient';
import { Task } from '@/types/task';
import { SchemaValidator } from '../utils/taskValidator';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { join } from 'path';
import { readFileSync } from 'fs';

export interface LLMContext {
  previousCommands: string[];
  worldState: {
    position: { x: number; y: number; z: number };
    inventory: { type: string; count: number }[];
    nearbyBlocks: { type: string; position: { x: number; y: number; z: number } }[];
  };
  taskHistory: {
    type: string;
    status: 'completed' | 'failed' | 'in_progress';
    timestamp: number;
  }[];
}

export interface PromptVersion {
  version: string;
  content: string;
  createdAt: number;
  isActive: boolean;
}

export class LLMService {
  private context: LLMContext;
  private promptVersions: Map<string, PromptVersion>;
  private activeModel: string;
  private availableModels: string[];

  constructor(
    private readonly llmClient: LLMClient,
    private readonly schemaValidator: SchemaValidator,
    private readonly promptsDir: string = join(__dirname, '..', 'prompts')
  ) {
    this.context = {
      previousCommands: [],
      worldState: {
        position: { x: 0, y: 0, z: 0 },
        inventory: [],
        nearbyBlocks: []
      },
      taskHistory: []
    };
    this.promptVersions = new Map();
    this.activeModel = process.env.OLLAMA_MODEL || 'llama3.2:1b';
    this.availableModels = [];
  }

  public async initialize(): Promise<void> {
    await this.loadPromptVersions();
    await this.loadAvailableModels();
  }

  private async loadPromptVersions(): Promise<void> {
    try {
      const promptFiles = ['parse-task.base.txt', 'parse-task.navigation.txt', 'parse-task.query.txt', 'parse-task.examples.txt'];
      
      for (const file of promptFiles) {
        const content = readFileSync(join(this.promptsDir, file), 'utf-8');
        const version = this.extractPromptVersion(content);
        
        this.promptVersions.set(file, {
          version,
          content,
          createdAt: Date.now(),
          isActive: true
        });
      }
    } catch (error) {
      logger.error('Failed to load prompt versions', { error });
      throw new LLMError('Failed to load prompt versions', 'PROMPT_LOAD_ERROR');
    }
  }

  private extractPromptVersion(content: string): string {
    const versionMatch = content.match(/version:\s*([\d.]+)/i);
    return versionMatch ? versionMatch[1] : '1.0.0';
  }

  private async loadAvailableModels(): Promise<void> {
    try {
      const response = await this.llmClient.listModels();
      this.availableModels = response.models.map((m: any) => m.name);
      logger.info('Loaded available models', { models: this.availableModels });
    } catch (error) {
      logger.error('Failed to load available models', { error });
      throw new LLMError('Failed to load available models', 'MODEL_LOAD_ERROR');
    }
  }

  public async switchModel(modelName: string): Promise<void> {
    if (!this.availableModels.includes(modelName)) {
      throw new LLMError(`Model ${modelName} not available`, 'MODEL_NOT_FOUND');
    }
    this.activeModel = modelName;
    logger.info('Switched LLM model', { model: modelName });
  }

  public updateContext(newContext: Partial<LLMContext>): void {
    this.context = { ...this.context, ...newContext };
    logger.debug('Updated LLM context', { context: this.context });
  }

  public async generateResponse(prompt: string): Promise<string> {
    const startTime = Date.now();
    try {
      const response = await this.llmClient.generate(prompt);
      const duration = (Date.now() - startTime) / 1000;
      
      metrics.llmRequests.inc({ model: this.activeModel });
      metrics.llmLatency.observe({ model: this.activeModel }, duration);
      
      return response;
    } catch (error) {
      metrics.llmRequests.inc({ model: this.activeModel });
      throw error;
    }
  }

  public async parseTask(description: string, playerName?: string): Promise<Task> {
    try {
      // Build context-aware prompt
      const contextPrompt = this.buildContextPrompt();
      const taskPrompt = this.buildTaskPrompt(description, playerName);
      const fullPrompt = `${contextPrompt}\n\n${taskPrompt}`;

      // Generate response
      const response = await this.generateResponse(fullPrompt);

      // Parse and validate response
      const task = this.parseResponse(response);
      this.schemaValidator.validate(task);

      // Update context
      this.updateContext({
        previousCommands: [...this.context.previousCommands, description],
        taskHistory: [
          ...this.context.taskHistory,
          { type: task.type, status: 'in_progress', timestamp: Date.now() }
        ]
      });

      return task;
    } catch (error) {
      logger.error('Failed to parse task', { error, description });
      throw error;
    }
  }

  private buildContextPrompt(): string {
    const basePrompt = this.promptVersions.get('parse-task.base.txt')?.content || '';
    const navPrompt = this.promptVersions.get('parse-task.navigation.txt')?.content || '';
    const queryPrompt = this.promptVersions.get('parse-task.query.txt')?.content || '';
    const examplesPrompt = this.promptVersions.get('parse-task.examples.txt')?.content || '';

    return `${basePrompt}\n\n${navPrompt}\n\n${queryPrompt}\n\n${examplesPrompt}\n\nContext:\n${JSON.stringify(this.context, null, 2)}`;
  }

  private buildTaskPrompt(description: string, playerName?: string): string {
    return `Command: ${description}${playerName ? `\nPlayer name: ${playerName}` : ''}`;
  }

  private parseResponse(response: string): Task {
    try {
      return JSON.parse(response) as Task;
    } catch (error) {
      throw new LLMError('Failed to parse LLM response as JSON', 'INVALID_JSON');
    }
  }

  public getActiveModel(): string {
    return this.activeModel;
  }

  public getAvailableModels(): string[] {
    return this.availableModels;
  }

  public getPromptVersion(fileName: string): PromptVersion | undefined {
    return this.promptVersions.get(fileName);
  }

  public getContext(): LLMContext {
    return this.context;
  }
} 