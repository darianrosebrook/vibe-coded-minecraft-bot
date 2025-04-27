import { Task, TaskType } from '../../types/task';
import { TaskContext } from '../types';


export interface AmbiguityPattern {
  id: string;
  pattern: RegExp;
  confidenceThreshold: number;
  contextFactors: string[];
}

export interface AmbiguityScore {
  patternId: string;
  confidence: number;
  contextRelevance: number;
  historicalSuccess: number;
  totalScore: number;
}

export interface AmbiguityResult {
  isAmbiguous: boolean;
  scores: AmbiguityScore[];
  suggestedTypes: TaskType[];
  contextFactors: Record<string, number>;
}

export class AmbiguityDetector {
  private patterns: AmbiguityPattern[] = [];
  private historicalSuccess: Map<string, number> = new Map();
  private contextWeights: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultPatterns();
    this.initializeContextWeights();
  }

  private initializeDefaultPatterns() {
    // Mining patterns
    this.addPattern({
      id: 'mining_ore',
      pattern: /mine\s+(diamond|iron|gold|coal|redstone|lapis|emerald)\s+(ore|block)/i,
      confidenceThreshold: 0.8,
      contextFactors: ['has_pickaxe', 'near_ore', 'inventory_space']
    });

    this.addPattern({
      id: 'mining_stone',
      pattern: /mine\s+(stone|cobblestone|granite|diorite|andesite)/i,
      confidenceThreshold: 0.7,
      contextFactors: ['has_pickaxe', 'inventory_space']
    });

    // Crafting patterns
    this.addPattern({
      id: 'crafting_tool',
      pattern: /craft\s+(wooden|stone|iron|gold|diamond|netherite)\s+(pickaxe|axe|shovel|hoe|sword)/i,
      confidenceThreshold: 0.9,
      contextFactors: ['has_materials', 'has_crafting_table']
    });

    this.addPattern({
      id: 'crafting_block',
      pattern: /craft\s+(planks|sticks|torches|chest|furnace)/i,
      confidenceThreshold: 0.8,
      contextFactors: ['has_materials', 'has_crafting_table']
    });

    // Navigation patterns
    this.addPattern({
      id: 'navigation_coordinates',
      pattern: /go\s+to\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/i,
      confidenceThreshold: 0.95,
      contextFactors: ['path_clear', 'safe_route']
    });

    this.addPattern({
      id: 'navigation_landmark',
      pattern: /go\s+to\s+(village|temple|mineshaft|stronghold|nether|end)/i,
      confidenceThreshold: 0.85,
      contextFactors: ['path_clear', 'safe_route', 'landmark_known']
    });
  }

  private initializeContextWeights() {
    this.contextWeights.set('has_pickaxe', 0.3);
    this.contextWeights.set('near_ore', 0.2);
    this.contextWeights.set('inventory_space', 0.1);
    this.contextWeights.set('has_materials', 0.3);
    this.contextWeights.set('has_crafting_table', 0.2);
    this.contextWeights.set('path_clear', 0.3);
    this.contextWeights.set('safe_route', 0.3);
    this.contextWeights.set('landmark_known', 0.2);
  }

  public addPattern(pattern: AmbiguityPattern) {
    this.patterns.push(pattern);
  }

  public async detectAmbiguity(command: string, context: TaskContext): Promise<AmbiguityResult> {
    const scores: AmbiguityScore[] = [];
    const contextFactors: Record<string, number> = {};

    // Calculate pattern matches and confidence scores
    for (const pattern of this.patterns) {
      const match = command.match(pattern.pattern);
      if (match) {
        const confidence = this.calculateConfidence(match, pattern, command);
        const contextRelevance = this.calculateContextRelevance(pattern, context);
        const historicalSuccess = this.getHistoricalSuccess(pattern.id);
        
        const totalScore = confidence * 0.4 + contextRelevance * 0.4 + historicalSuccess * 0.2;
        
        scores.push({
          patternId: pattern.id,
          confidence,
          contextRelevance,
          historicalSuccess,
          totalScore
        });

        // Track context factor relevance
        for (const factor of pattern.contextFactors) {
          contextFactors[factor] = (contextFactors[factor] || 0) + contextRelevance;
        }
      }
    }

    // Sort scores by total score
    scores.sort((a, b) => b.totalScore - a.totalScore);

    // Determine if the command is ambiguous
    const isAmbiguous = scores.length > 1 && 
                       scores[0].totalScore - scores[1].totalScore < 0.2;

    // Get suggested task types
    const suggestedTypes = scores
      .filter(score => score.totalScore > 0.5)
      .map(score => this.patternToTaskType(score.patternId));

    return {
      isAmbiguous,
      scores,
      suggestedTypes,
      contextFactors
    };
  }

  private calculateConfidence(match: RegExpMatchArray, pattern: AmbiguityPattern, command: string): number {
    // Base confidence on match completeness
    const matchCompleteness = match[0].length / command.length;
    
    // Adjust for pattern specificity
    const specificity = pattern.pattern.toString().length / 100;
    
    return (matchCompleteness * 0.7 + specificity * 0.3) * pattern.confidenceThreshold;
  }

  private calculateContextRelevance(pattern: AmbiguityPattern, context: TaskContext): number {
    let relevance = 0;
    
    for (const factor of pattern.contextFactors) {
      const weight = this.contextWeights.get(factor) || 0;
      const factorValue = this.evaluateContextFactor(factor, context);
      relevance += weight * factorValue;
    }

    return relevance;
  }

  private evaluateContextFactor(factor: string, context: TaskContext): number {
    switch (factor) {
      case 'has_pickaxe':
        return context.worldState.inventory.hasTool('pickaxe') ? 1 : 0;
      case 'near_ore':
        return context.worldState.surroundings.some((block: any) => 
          block.type.includes('_ore')) ? 1 : 0;
      case 'inventory_space':
        return context.worldState.inventory.hasSpace() ? 1 : 0;
      case 'has_materials':
        return context.worldState.inventory.hasMaterials(['planks', 'sticks']) ? 1 : 0;
      case 'has_crafting_table':
        return context.worldState.surroundings.some((block: any) => 
          block.type === 'crafting_table') ? 1 : 0;
      case 'path_clear':
        return context.worldState.pathfinding?.isPathClear ? 1 : 0;
      case 'safe_route':
        return context.worldState.pathfinding?.isRouteSafe ? 1 : 0;
      case 'landmark_known':
        return (context.worldState.pathfinding?.knownLandmarks ?? []).length > 0 ? 1 : 0;
      default:
        return 0;
    }
  }

  private getHistoricalSuccess(patternId: string): number {
    return this.historicalSuccess.get(patternId) || 0.5;
  }

  private patternToTaskType(patternId: string): TaskType {
    if (patternId.startsWith('mining_')) return TaskType.MINING;
    if (patternId.startsWith('crafting_')) return TaskType.CRAFTING;
    if (patternId.startsWith('navigation_')) return TaskType.NAVIGATION;
    return TaskType.UNKNOWN;
  }

  public updateHistoricalSuccess(patternId: string, success: boolean) {
    const currentSuccess = this.historicalSuccess.get(patternId) || 0.5;
    const newSuccess = currentSuccess * 0.9 + (success ? 0.1 : 0);
    this.historicalSuccess.set(patternId, newSuccess);
  }
} 