import { ParsingError, ErrorRecoveryStrategy } from '../error/handler';
import { MLCommandParserImpl } from '../../ml/command/parser';
import { TaskContext } from '@/types';
import { LLMClient } from '../../utils/llmClient';


export interface TaskResolution {
  success: boolean;
  result: any;
  confidence: number;
  alternatives: Array<{
    result: any;
    confidence: number;
  }>;
  context: TaskContext;
}

export interface ResolutionStrategy {
  name: string;
  description: string;
  priority: number;
  conditions: (context: TaskContext) => boolean;
  execute: (context: TaskContext) => Promise<TaskResolution>;
}

export class TaskResolutionSystem {
  private mlParser: MLCommandParserImpl;
  private strategies: ResolutionStrategy[] = [];
  private resolutionHistory: Map<string, number> = new Map();

  constructor(llmClient: LLMClient) {
    this.mlParser = new MLCommandParserImpl(llmClient);
    this.initializeStrategies();
  }

  private initializeStrategies() {
    this.strategies = [
      {
        name: 'Direct Resolution',
        description: 'Attempt to resolve the task directly using available context',
        priority: 1,
        conditions: (context) => this.hasCompleteContext(context),
        execute: async (context) => this.resolveDirectly(context)
      },
      {
        name: 'Context-Aware Resolution',
        description: 'Use ML to enhance context and resolve the task',
        priority: 2,
        conditions: (context) => this.hasPartialContext(context),
        execute: async (context) => this.resolveWithML(context)
      },
      {
        name: 'Fallback Resolution',
        description: 'Use fallback mechanisms to resolve the task',
        priority: 3,
        conditions: () => true, // Always available as fallback
        execute: async (context) => this.resolveWithFallback(context)
      }
    ];
  }

  async resolveTask(context: TaskContext): Promise<TaskResolution> {
    // Track resolution attempts
    this.trackResolution('attempt');

    try {
      // Find the most appropriate strategy
      const strategy = this.selectStrategy(context);
      
      // Execute the strategy
      const result = await strategy.execute(context);
      
      // Track successful resolution
      this.trackResolution('success');
      
      return result;
    } catch (error) {
      // Track failed resolution
      this.trackResolution('failure');
      
      // Handle the error
      return this.handleResolutionError(error as ParsingError, context);
    }
  }

  private selectStrategy(context: TaskContext): ResolutionStrategy {
    // Sort strategies by priority
    const sortedStrategies = [...this.strategies].sort((a, b) => a.priority - b.priority);
    
    // Find the first strategy that meets its conditions
    const strategy = sortedStrategies.find(s => s.conditions(context));
    
    if (!strategy) {
      throw new Error('No suitable resolution strategy found');
    }
    
    return strategy;
  }

  private async resolveDirectly(context: TaskContext): Promise<TaskResolution> {
    // Implement direct resolution logic
    return {
      success: true,
      result: context,
      confidence: 0.9,
      alternatives: [],
      context
    };
  }

  private async resolveWithML(context: TaskContext): Promise<TaskResolution> {
    // Use ML to enhance context and resolve
    const enhancedContext = await this.enhanceContext(context);
    
    return {
      success: true,
      result: enhancedContext,
      confidence: 0.8,
      alternatives: [],
      context: enhancedContext
    };
  }

  private async resolveWithFallback(context: TaskContext): Promise<TaskResolution> {
    // Implement fallback resolution logic
    return {
      success: true,
      result: context,
      confidence: 0.6,
      alternatives: [],
      context
    };
  }

  private async enhanceContext(context: TaskContext): Promise<TaskContext> {
    // Use ML to enhance the context
    // This is a placeholder - implement actual enhancement logic
    return context;
  }

  private async handleResolutionError(
    error: ParsingError,
    context: TaskContext
  ): Promise<TaskResolution> {
    // Create a recovery strategy
    const recoveryStrategy: ErrorRecoveryStrategy = {
      name: 'Error Recovery',
      description: 'Attempt to recover from the error',
      steps: ['Identify error', 'Apply recovery strategy', 'Retry resolution'],
      confidence: 0.5
    };

    return {
      success: false,
      result: error,
      confidence: 0,
      alternatives: [],
      context: {
        ...context,
        pluginContext: {
          ...context.pluginContext,
          error: error.message,
          recoveryStrategy
        }
      }
    };
  }

  private hasCompleteContext(context: TaskContext): boolean {
    // Check if context has all required information
    return (
      context.worldState.inventory !== undefined &&
      context.worldState.position !== undefined &&
      context.worldState.surroundings !== undefined
    );
  }

  private hasPartialContext(context: TaskContext): boolean {
    // Check if context has at least some required information
    return (
      context.worldState.inventory !== undefined ||
      context.worldState.position !== undefined ||
      context.worldState.surroundings !== undefined
    );
  }

  private trackResolution(type: 'attempt' | 'success' | 'failure') {
    const count = this.resolutionHistory.get(type) || 0;
    this.resolutionHistory.set(type, count + 1);
  }

  getResolutionStatistics(): Map<string, number> {
    return new Map(this.resolutionHistory);
  }
} 