import { MLResponseGenerator, ResponseQuality, IntentClassification, CommandContext } from '@/types/ml/command';
import { TaskContext } from '@/llm/types';
import { LLMClient } from '../../utils/llmClient';
import { TaskType, TaskStatus, TaskParameters, TaskPriority } from '@/types/task';
import { Vec3 } from 'vec3';
import { MinecraftBot } from '../../bot/bot';

export class MLResponseGeneratorImpl implements MLResponseGenerator {
  private llmClient: LLMClient;
  private responseTemplates: Map<string, string> = new Map();
  private qualityMetrics: Map<string, number> = new Map();


  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
    this.initializeResponseTemplates();
  }

  private initializeResponseTemplates() {
    // Load predefined response templates
    this.responseTemplates.set('mining', 'I will mine {block} for you.');
    this.responseTemplates.set('crafting', 'I will craft {item} for you.');
    this.responseTemplates.set('navigation', 'I will go to {location}.');
    this.responseTemplates.set('error', 'I encountered an error: {error}.');
  }
  
  // Implementing the interface method
  async generate(intent: IntentClassification, context: CommandContext): Promise<string> {
    const command = intent.intent;
    const taskContext: TaskContext = this.convertToTaskContext(intent, context);
    const prompt = this.generateResponsePrompt(command, taskContext);
    const response = await this.llmClient.generate(prompt);
    
    // Score the response
    const quality = await this.evaluate(response, context);
    
    // If quality is low, try to optimize
    if (quality.clarity < 0.7) {
      return this.optimize(response, context);
    }
    
    return response;
  }

  // Implementing the interface method
  async evaluate(response: string, context: CommandContext): Promise<ResponseQuality> {
    const prompt = this.generateQualityScoringPrompt(response);
    const result = await this.llmClient.generate(prompt);
    
    return this.parseQualityResponse(result);
  }

  // Implementing the interface method
  async optimize(response: string, context: CommandContext): Promise<string> {
    const prompt = this.generateOptimizationPrompt(response);
    return this.llmClient.generate(prompt);
  }

  private convertToTaskContext(intent: IntentClassification, context: CommandContext): TaskContext {
    // Convert CommandContext to TaskContext
    return {
      bot: null as unknown as MinecraftBot,
      conversationHistory: [],
      worldState: {
        inventory: {
          hasTool: (tool: string) => {
            const inventory = context.gameState?.botState?.inventory;
            if (!inventory) return false;
            return inventory.items.some(item => item.type === tool);
          },
          hasMaterials: (materials: string[]) => {
            const inventory = context.gameState?.botState?.inventory;
            if (!inventory) return false;
            return materials.every(m => inventory.items.some(item => item.type === m));
          },
          hasSpace: () => {
            const inventory = context.gameState?.botState?.inventory;
            if (!inventory) return true;
            return inventory.items.length < (inventory.size || 36);
          },
          items: context.gameState?.botState?.inventory?.items?.map(item => ({
            name: item.type,
            count: item.quantity,
          })) || []
        },
        position: context.gameState?.botState?.position || new Vec3(0, 0, 0),
        surroundings: context.gameState?.nearbyBlocks?.map(block => ({
          type: block.type,
          position: block.position
        })) || [],
        time: context.gameState?.worldState?.time || 0
      },
      botState: {
        health: context.gameState?.botState?.health || 0,
        hunger: context.gameState?.botState?.food || 0,
        position: context.gameState?.botState?.position || new Vec3(0, 0, 0),
        biome: context.gameState?.worldState?.dimension,
        isDay: (context.gameState?.worldState?.time || 0) < 13000 || (context.gameState?.worldState?.time || 0) > 23000,
        isRaining: context.gameState?.worldState?.weather === 'rain'
      },
      recentTasks: context.gameState?.taskHistory?.map(task => ({
        type: task.type as unknown as TaskType,
        parameters: {} as TaskParameters,
        status: task.status === 'completed' ? 'success' : 'failure',
        timestamp: task.startTime || Date.now()
      })) || [],
      pluginContext: {},
      currentTask: {
        id: '',
        type: intent.intent as TaskType,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        parameters: intent.parameters as TaskParameters
      }
    };
  }

  private generateResponsePrompt(command: string, context: TaskContext): string {
    return `
Given the following command and context:
Command: "${command}"
Context: ${JSON.stringify(context, null, 2)}

Generate a clear, concise, and helpful response. The response should:
1. Acknowledge the command
2. Explain what will be done
3. Include any relevant context
4. Be friendly and professional
`;
  }

  private generateQualityScoringPrompt(response: string): string {
    return `
Score the quality of this response: "${response}"

Return a JSON object with:
- score: Overall quality score (0-1)
- metrics: {
    clarity: Score for clarity (0-1)
    specificity: Score for specificity (0-1)
    completeness: Score for completeness (0-1)
    relevance: Score for relevance (0-1)
  }
- suggestions: Array of improvement suggestions
`;
  }

  private generateOptimizationPrompt(response: string): string {
    return `
Optimize this response to be more clear, specific, and helpful: "${response}"

Return the optimized response that:
1. Is more concise
2. Has better clarity
3. Includes more specific details
4. Is more helpful
`;
  }

  private parseQualityResponse(response: string): ResponseQuality {
    try {
      return JSON.parse(response);
    } catch (error) {
      return { 
        clarity: 0,
        completeness: 0,
        relevance: 0,
        confidence: 0,
      };
    }
  }

  private applyTemplate(template: string, parameters: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(parameters)) {
      result = result.replace(`{${key}}`, value);
    }
    return result;
  }
} 