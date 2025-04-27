import { Task, TaskType } from '../../types/task';
import { TaskContext } from '../types';
import { AmbiguityDetector, AmbiguityResult } from './ambiguity_detector';

export interface DisambiguationResult {
  resolvedType: TaskType;
  confidence: number;
  contextFactors: Record<string, number>;
  historicalPatterns: string[];
  currentStateRelevance: number;
}

export interface HistoricalPattern {
  command: string;
  resolvedType: TaskType;
  success: boolean;
  timestamp: number;
  contextFactors: Record<string, number>;
}

export class ContextDisambiguator {
  private detector: AmbiguityDetector;
  private historicalPatterns: HistoricalPattern[] = [];
  private maxHistorySize: number = 1000;
  private contextDecayRate: number = 0.95; // 5% decay per hour

  constructor(detector: AmbiguityDetector) {
    this.detector = detector;
  }

  public async disambiguate(
    command: string,
    context: TaskContext,
    ambiguityResult: AmbiguityResult
  ): Promise<DisambiguationResult> {
    if (!ambiguityResult.isAmbiguous) {
      return {
        resolvedType: ambiguityResult.suggestedTypes[0],
        confidence: ambiguityResult.scores[0].totalScore,
        contextFactors: ambiguityResult.contextFactors,
        historicalPatterns: [],
        currentStateRelevance: 1
      };
    }

    // Calculate context-based scores
    const contextScores = this.calculateContextScores(ambiguityResult, context);
    
    // Find historical patterns
    const historicalMatches = this.findHistoricalPatterns(command, context);
    
    // Calculate current state relevance
    const currentStateRelevance = this.calculateCurrentStateRelevance(context);
    
    // Combine scores and determine final type
    const finalScores = this.combineScores(
      ambiguityResult,
      contextScores,
      historicalMatches,
      currentStateRelevance
    );

    // Get the highest scoring type
    const resolvedType = this.getHighestScoringType(finalScores);

    return {
      resolvedType,
      confidence: ambiguityResult.scores[0].totalScore,
      contextFactors: ambiguityResult.contextFactors,
      historicalPatterns: historicalMatches.map(m => m.command),
      currentStateRelevance
    };
  }

  private calculateContextScores(
    ambiguityResult: AmbiguityResult,
    context: TaskContext
  ): Map<TaskType, number> {
    const scores = new Map<TaskType, number>();
    
    for (const score of ambiguityResult.scores) {
      const type = this.detector['patternToTaskType'](score.patternId);
      const contextScore = this.calculateContextScore(score, context);
      scores.set(type, (scores.get(type) || 0) + contextScore);
    }

    return scores;
  }

  private calculateContextScore(
    score: AmbiguityResult['scores'][0],
    context: TaskContext
  ): number {
    let totalScore = 0;
    
    // Check inventory state
    if (context.worldState) {
      if (score.patternId.startsWith('mining_') && context.worldState.inventory.hasTool('pickaxe')) {
        totalScore += 0.3;
      }
      if (score.patternId.startsWith('crafting_') && context.worldState.inventory.hasMaterials(['planks', 'sticks'])) {
        totalScore += 0.3;
      }
    }

    // Check world state
    if (context.worldState) {
      if (score.patternId.startsWith('navigation_') && context.worldState.pathfinding?.isPathClear) {
        totalScore += 0.2;
      }
      if (score.patternId.startsWith('mining_') && context.worldState.surroundings.some((b: any) => 
        b.type.includes('_ore'))) {
        totalScore += 0.2;
      }
    }

    // Check recent tasks
    if (context.recentTasks) {
      const recentType = context.recentTasks[0]?.type;
      if (recentType && score.patternId.startsWith(recentType)) {
        totalScore += 0.2;
      }
    }

    return totalScore;
  }

  private findHistoricalPatterns(
    command: string,
    context: TaskContext
  ): HistoricalPattern[] {
    const now = Date.now();
    const relevantPatterns = this.historicalPatterns
      .filter(pattern => {
        const ageHours = (now - pattern.timestamp) / (1000 * 60 * 60);
        const decayFactor = Math.pow(this.contextDecayRate, ageHours);
        return decayFactor > 0.1; // Only consider patterns with >10% relevance
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5); // Only consider the 5 most recent relevant patterns

    return relevantPatterns;
  }

  private calculateCurrentStateRelevance(context: TaskContext): number {
    let relevance = 0;

    // Check health and hunger
    if (context.botState) {
      if (context.botState.health < 10) {
        relevance += 0.3; // High relevance for low health
      }
      if (context.botState.hunger < 5) {
        relevance += 0.2; // Medium relevance for low hunger
      }
    }

    // Check inventory space
    if (context.worldState?.inventory?.hasSpace()) {
      relevance += 0.2;
    }

    // Check time of day
    if (context.worldState?.time) {
      const isNight = context.worldState.time > 13000;
      if (isNight) {
        relevance += 0.3; // High relevance for night time
      }
    }

    return Math.min(relevance, 1);
  }

  private combineScores(
    ambiguityResult: AmbiguityResult,
    contextScores: Map<TaskType, number>,
    historicalPatterns: HistoricalPattern[],
    currentStateRelevance: number
  ): Map<TaskType, number> {
    const finalScores = new Map<TaskType, number>();

    // Combine ambiguity scores with context scores
    for (const score of ambiguityResult.scores) {
      const type = this.detector['patternToTaskType'](score.patternId);
      const ambiguityScore = score.totalScore;
      const contextScore = contextScores.get(type) || 0;
      const historicalScore = this.calculateHistoricalScore(type, historicalPatterns);
      
      const combinedScore = 
        ambiguityScore * 0.4 +
        contextScore * 0.3 +
        historicalScore * 0.2 +
        currentStateRelevance * 0.1;

      finalScores.set(type, combinedScore);
    }

    return finalScores;
  }

  private calculateHistoricalScore(
    type: TaskType,
    historicalPatterns: HistoricalPattern[]
  ): number {
    if (historicalPatterns.length === 0) return 0.5;

    const relevantPatterns = historicalPatterns.filter(p => p.resolvedType === type);
    if (relevantPatterns.length === 0) return 0.5;

    const successRate = relevantPatterns.filter(p => p.success).length / relevantPatterns.length;
    return successRate;
  }

  private getHighestScoringType(scores: Map<TaskType, number>): TaskType {
    let highestScore = -1;
    let highestType: TaskType = TaskType.UNKNOWN;

    for (const [type, score] of scores) {
      if (score > highestScore) {
        highestScore = score;
        highestType = type;
      }
    }

    return highestType;
  }

  public addHistoricalPattern(pattern: HistoricalPattern) {
    this.historicalPatterns.push(pattern);
    
    // Maintain history size limit
    if (this.historicalPatterns.length > this.maxHistorySize) {
      this.historicalPatterns.sort((a, b) => b.timestamp - a.timestamp);
      this.historicalPatterns = this.historicalPatterns.slice(0, this.maxHistorySize);
    }
  }

  public clearHistory() {
    this.historicalPatterns = [];
  }
} 