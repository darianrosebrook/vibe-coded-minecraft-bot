import { MLErrorHandler, ErrorPrediction } from '@/types';
import { TaskContext } from '@/types';
import { LLMClient } from '../../utils/llmClient';

export class MLErrorHandlerImpl implements MLErrorHandler {
  private llmClient: LLMClient;
  private errorPatterns: Map<string, string[]> = new Map();
  private recoveryStrategies: Map<string, string[]> = new Map();

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
    this.initializeErrorPatterns();
    this.initializeRecoveryStrategies();
  }

  private initializeErrorPatterns() {
    // Load predefined error patterns
    this.errorPatterns.set('inventory_full', [
      'inventory is full',
      'no space left',
      'cannot pick up'
    ]);
    this.errorPatterns.set('tool_required', [
      'need a tool',
      'requires a tool',
      'cannot mine without'
    ]);
    this.errorPatterns.set('path_blocked', [
      'path is blocked',
      'cannot reach',
      'obstructed path'
    ]);
  }

  private initializeRecoveryStrategies() {
    // Load predefined recovery strategies
    this.recoveryStrategies.set('inventory_full', [
      'Drop least valuable items',
      'Sort inventory',
      'Return to base'
    ]);
    this.recoveryStrategies.set('tool_required', [
      'Craft required tool',
      'Find tool in inventory',
      'Ask for tool'
    ]);
    this.recoveryStrategies.set('path_blocked', [
      'Find alternative path',
      'Break blocking blocks',
      'Wait for path to clear'
    ]);
  }

  async predictErrors(command: string, context: TaskContext): Promise<ErrorPrediction[]> {
    const prompt = this.generateErrorPredictionPrompt(command, context);
    const response = await this.llmClient.generate(prompt);
    
    return this.parseErrorPredictions(response);
  }

  async suggestCorrections(error: Error): Promise<string[]> {
    const prompt = this.generateCorrectionPrompt(error);
    const response = await this.llmClient.generate(prompt);
    
    return this.parseCorrections(response);
  }

  async selectRecoveryStrategy(error: Error): Promise<string> {
    const prompt = this.generateRecoveryPrompt(error);
    const response = await this.llmClient.generate(prompt);
    
    return this.parseRecoveryStrategy(response);
  }

  private generateErrorPredictionPrompt(command: string, context: TaskContext): string {
    return `
Predict potential errors for the command: "${command}"
Context: ${JSON.stringify(context, null, 2)}

Return a JSON array of error predictions with:
- likelihood: Error likelihood (0-1)
- potentialErrors: Array of potential errors with:
  - type: Error type
  - description: Error description
  - severity: Error severity (low/medium/high)
  - preventionSteps: Steps to prevent the error
`;
  }

  private generateCorrectionPrompt(error: Error): string {
    return `
Suggest corrections for this error: "${error.message}"

Return a JSON array of correction suggestions that:
1. Address the specific error
2. Provide clear steps
3. Include context-aware solutions
4. Consider current game state
`;
  }

  private generateRecoveryPrompt(error: Error): string {
    return `
Select the best recovery strategy for this error: "${error.message}"

Return a JSON object with:
- strategy: The selected recovery strategy
- confidence: Confidence in the strategy (0-1)
- steps: Detailed steps to implement the strategy
- fallback: Alternative strategy if primary fails
`;
  }

  private parseErrorPredictions(response: string): ErrorPrediction[] {
    try {
      return JSON.parse(response);
    } catch (error) {
      return [];
    }
  }

  private parseCorrections(response: string): string[] {
    try {
      return JSON.parse(response);
    } catch (error) {
      return [];
    }
  }

  private parseRecoveryStrategy(response: string): string {
    try {
      const result = JSON.parse(response);
      return result.strategy || 'Unknown recovery strategy';
    } catch (error) {
      return 'Unknown recovery strategy';
    }
  }

  private matchErrorPattern(error: Error): string | null {
    const errorMessage = error.message.toLowerCase();
    for (const [type, patterns] of this.errorPatterns) {
      if (patterns.some(pattern => errorMessage.includes(pattern))) {
        return type;
      }
    }
    return null;
  }

  private getRecoveryStrategies(errorType: string): string[] {
    return this.recoveryStrategies.get(errorType) || [];
  }
} 