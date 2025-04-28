import { TaskType } from '@/types/task';
import { TaskContext } from '@/types';

import { ContextDisambiguator, DisambiguationResult } from './context_disambiguator';

export interface ConfirmationPrompt {
  command: string;
  options: Array<{
    type: TaskType;
    description: string;
    confidence: number;
  }>;
  context: TaskContext;
  timestamp: number;
  expiresAt: number;
}

export interface ConfirmationResponse {
  selectedType: TaskType;
  timestamp: number;
  context: TaskContext;
}

export class UserConfirmationHandler {
  private pendingConfirmations: Map<string, ConfirmationPrompt> = new Map();
  private confirmationTimeout: number = 30000; // 30 seconds
  private maxPendingConfirmations: number = 10;

  constructor(private disambiguator: ContextDisambiguator) {}

  public async handleAmbiguousCommand(
    command: string,
    context: TaskContext,
    disambiguationResult: DisambiguationResult
  ): Promise<ConfirmationPrompt | TaskType> {
    // If confidence is high enough, proceed without confirmation
    if (disambiguationResult.confidence >= 0.9) {
      return disambiguationResult.resolvedType;
    }

    // Create confirmation prompt
    const prompt: ConfirmationPrompt = {
      command,
      options: this.generateOptions(disambiguationResult),
      context,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.confirmationTimeout
    };

    // Store the confirmation
    this.storeConfirmation(prompt);

    return prompt;
  }

  public async processConfirmation(
    command: string,
    selectedType: TaskType,
    context: TaskContext
  ): Promise<boolean> {
    if (!command || !selectedType || !context) {
      throw new Error('Command, selectedType, and context are required');
    }

    const prompt = this.pendingConfirmations.get(command);
    if (!prompt) {
      return false;
    }

    if (Date.now() > prompt.expiresAt) {
      this.pendingConfirmations.delete(command);
      return false;
    }

    this.disambiguator['addHistoricalPattern']({
      command,
      resolvedType: selectedType,
      success: true,
      timestamp: Date.now(),
      contextFactors: {
        timeOfDay: context.worldState.time,
        position: Math.sqrt(
          context.worldState.position.x ** 2 +
          context.worldState.position.y ** 2 +
          context.worldState.position.z ** 2
        ),
        inventorySize: context.worldState.inventory.items.length
      }
    });

    this.pendingConfirmations.delete(command);
    return true;
  }

  public getPendingConfirmation(command: string): ConfirmationPrompt | undefined {
    return this.pendingConfirmations.get(command);
  }

  public cleanupExpiredConfirmations(): void {
    const now = Date.now();
    for (const [command, prompt] of this.pendingConfirmations.entries()) {
      if (now > prompt.expiresAt) {
        this.pendingConfirmations.delete(command);
      }
    }
  }

  private generateOptions(result: DisambiguationResult): Array<{
    type: TaskType;
    description: string;
    confidence: number;
  }> {
    return [
      {
        type: result.resolvedType,
        description: this.generateDescription(result.resolvedType, result),
        confidence: result.confidence
      },
      ...result.historicalPatterns.map(pattern => ({
        type: pattern as TaskType,
        description: this.generateDescription(pattern as TaskType, result),
        confidence: result.confidence * 0.8 // Historical patterns get slightly lower confidence
      }))
    ].sort((a, b) => b.confidence - a.confidence);
  }

  private generateDescription(type: TaskType, result: DisambiguationResult): string {
    const contextFactors = Object.entries(result.contextFactors)
      .filter(([_, value]) => value > 0.5)
      .map(([key]) => key)
      .join(', ');

    return `${type} (${contextFactors ? `based on ${contextFactors}` : 'default option'})`;
  }

  private storeConfirmation(prompt: ConfirmationPrompt): void {
    // Clean up expired confirmations first
    this.cleanupExpiredConfirmations();

    // If we're at the limit, remove the oldest confirmation
    if (this.pendingConfirmations.size >= this.maxPendingConfirmations) {
      const oldestCommand = Array.from(this.pendingConfirmations.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.pendingConfirmations.delete(oldestCommand);
    }

    this.pendingConfirmations.set(prompt.command, prompt);
  }
} 