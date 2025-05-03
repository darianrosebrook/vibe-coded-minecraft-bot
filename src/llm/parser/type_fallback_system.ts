import { Task, TaskType } from '@/types/task';
import { ContextAwareTypeDetectionResult } from './context_aware_type_detection';
import { ErrorCategory, ErrorSeverity } from '@/types/core';

interface TypeFallbackResult {
  type: TaskType;
  confidence: number;
  alternatives: Array<{
    type: TaskType;
    confidence: number;
    reasons: string[];
  }>;
  warnings: string[];
  resolutionPath: string[];
}

interface TypeScoringRule {
  type: TaskType;
  baseScore: number;
  contextFactors: Array<{
    factor: string;
    weight: number;
    condition: (context: any) => boolean;
  }>;
  historicalWeight: number;
}

interface TypeResolutionChain {
  type: TaskType;
  fallbacks: Array<{
    type: TaskType;
    conditions: Array<(context: any) => boolean>;
    priority: number;
  }>;
}

export class TypeFallbackSystem {
  private scoringRules: Map<TaskType, TypeScoringRule>;
  private resolutionChains: Map<TaskType, TypeResolutionChain>;
  private historicalSuccessRates: Map<TaskType, number>;

  constructor() {
    this.scoringRules = new Map();
    this.resolutionChains = new Map();
    this.historicalSuccessRates = new Map();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Initialize scoring rules for each task type
    this.scoringRules.set(TaskType.MINING, {
      type: TaskType.MINING,
      baseScore: 0.8,
      contextFactors: [
        {
          factor: 'hasPickaxe',
          weight: 0.3,
          condition: (context: any) => context.equipment.some((e: any) => e.type.includes('pickaxe'))
        },
        {
          factor: 'nearOre',
          weight: 0.2,
          condition: (context: any) => context.nearbyBlocks.some((b: any) => b.type.includes('ore'))
        }
      ],
      historicalWeight: 0.1
    });

    this.scoringRules.set(TaskType.CRAFTING, {
      type: TaskType.CRAFTING,
      baseScore: 0.7,
      contextFactors: [
        {
          factor: 'hasMaterials',
          weight: 0.4,
          condition: (context) => context.inventory.length > 0
        },
        {
          factor: 'nearCraftingTable',
          weight: 0.2,
          condition: (context: any) => context.nearbyBlocks.some((b: any) => b.type === 'crafting_table')
        }
      ],
      historicalWeight: 0.1
    });

    // Initialize resolution chains
    this.resolutionChains.set(TaskType.MINING, {
      type: TaskType.MINING,
      fallbacks: [
        {
          type: TaskType.CRAFTING,
          conditions: [
            (context: any) => !context.equipment.some((e: any) => e.type.includes('pickaxe')),
            (context: any) => context.inventory.some((i: any) => i.type.includes('wood'))
          ],
          priority: 1
        },
        {
          type: TaskType.MINING,
          conditions: [
            (context: any) => !context.nearbyBlocks.some((b: any) => b.type.includes('ore')),
            (context: any) => context.nearbyBlocks.some((b: any) => b.type.includes('tree'))
          ],
          priority: 2
        }
      ]
    });
  }

  public async resolveType(
    detectionResult: ContextAwareTypeDetectionResult,
    context: any
  ): Promise<TypeFallbackResult> {
    const baseType = detectionResult.type;
    const confidence = await this.calculateConfidence(baseType, context);
    const alternatives = await this.generateAlternatives(baseType, context);
    const resolutionPath = await this.followResolutionChain(baseType, context);

    return {
      type: this.determineFinalType(baseType, confidence, alternatives),
      confidence,
      alternatives,
      warnings: detectionResult.warnings,
      resolutionPath
    };
  }

  private async calculateConfidence(
    type: TaskType,
    context: any
  ): Promise<number> {
    const rule = this.scoringRules.get(type);
    if (!rule) return 0.5; // Default confidence if no rule exists

    let score = rule.baseScore;

    // Apply context factors
    for (const factor of rule.contextFactors) {
      if (factor.condition(context)) {
        score += factor.weight;
      }
    }

    // Apply historical success rate
    const historicalRate = this.historicalSuccessRates.get(type) || 0.5;
    score += historicalRate * rule.historicalWeight;

    // Normalize score to [0, 1]
    return Math.min(Math.max(score, 0), 1);
  }

  private async generateAlternatives(
    baseType: TaskType,
    context: any
  ): Promise<Array<{ type: TaskType; confidence: number; reasons: string[] }>> {
    const alternatives: Array<{ type: TaskType; confidence: number; reasons: string[] }> = [];
    const chain = this.resolutionChains.get(baseType);

    if (chain) {
      for (const fallback of chain.fallbacks) {
        if (fallback.conditions.every(condition => condition(context))) {
          const confidence = await this.calculateConfidence(fallback.type, context);
          alternatives.push({
            type: fallback.type,
            confidence,
            reasons: [
              `Conditions met for fallback to ${fallback.type}`,
              `Priority: ${fallback.priority}`
            ]
          });
        }
      }
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence);
  }

  private async followResolutionChain(
    type: TaskType,
    context: any
  ): Promise<string[]> {
    const path: string[] = [type];
    let currentType = type;
    let visited = new Set<string>();

    while (currentType && !visited.has(currentType)) {
      visited.add(currentType);
      const chain = this.resolutionChains.get(currentType);

      if (!chain) break;

      const validFallback = chain.fallbacks
        .sort((a, b) => a.priority - b.priority)
        .find(fallback => fallback.conditions.every(condition => condition(context)));

      if (!validFallback) break;

      currentType = validFallback.type;
      path.push(currentType);
    }

    return path;
  }

  private determineFinalType(
    baseType: TaskType,
    confidence: number,
    alternatives: Array<{ type: TaskType; confidence: number; reasons: string[] }>
  ): TaskType {
    // If confidence is high enough, stick with base type
    if (confidence >= 0.7) {
      return baseType;
    }

    // If we have alternatives with higher confidence, use the best one
    const bestAlternative = alternatives[0];
    if (bestAlternative && bestAlternative.confidence > confidence) {
      return bestAlternative.type;
    }

    // If all else fails, return base type
    return baseType;
  }

  public updateHistoricalSuccessRate(type: TaskType, success: boolean): void {
    const currentRate = this.historicalSuccessRates.get(type) || 0.5;
    const newRate = currentRate * 0.9 + (success ? 0.1 : 0);
    this.historicalSuccessRates.set(type, newRate);
  }
} 