import { MLResponseGenerator, ResponseQuality } from '@/types';
import { TaskContext } from '@/types';
import { LLMClient } from '../../utils/llmClient';

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

  async generateResponse(command: string, context: TaskContext): Promise<string> {
    const prompt = this.generateResponsePrompt(command, context);
    const response = await this.llmClient.generate(prompt);
    
    // Score the response
    const quality = await this.scoreResponse(response);
    
    // If quality is low, try to optimize
    if (quality.score < 0.7) {
      return this.optimizeResponse(response);
    }
    
    return response;
  }

  async scoreResponse(response: string): Promise<ResponseQuality> {
    const prompt = this.generateQualityScoringPrompt(response);
    const result = await this.llmClient.generate(prompt);
    
    return this.parseQualityResponse(result);
  }

  async optimizeResponse(response: string): Promise<string> {
    const prompt = this.generateOptimizationPrompt(response);
    return this.llmClient.generate(prompt);
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
        score: 0,
        metrics: {
          clarity: 0,
          specificity: 0,
          completeness: 0,
          relevance: 0
        },
        suggestions: []
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