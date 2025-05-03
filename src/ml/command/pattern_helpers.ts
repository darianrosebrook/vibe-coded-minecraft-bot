import { CommandContext, CommandPattern } from '@/types/ml/command';
import { GameStateFactory } from '@/types/ml/gameState';
import logger from '../../utils/observability/logger';
import { Vec3 } from 'vec3';

/**
 * Create a default command context using GameStateFactory
 */
export function createDefaultCommandContext(): CommandContext {
  try {
    return GameStateFactory.createCommandContext();
  } catch (error) {
    logger.error('Failed to create default command context', { error });
    throw error;
  }
}

/**
 * Create a new command pattern with standard fields
 */
export function createCommandPattern(
  pattern: string,
  intent: string,
  parameters: Record<string, string>,
  examples: string[] = [],
  confidence: number = 0.8
): CommandPattern {
  try {
    return {
      pattern,
      intent,
      parameters,
      examples,
      context: createDefaultCommandContext(),
      metadata: {
        confidence,
        updateTimestamp: Date.now(),
        createdTimestamp: Date.now(),
        usageCount: 0
      }
    };
  } catch (error) {
    logger.error('Failed to create command pattern', { error, pattern, intent });
    throw error;
  }
}

/**
 * Get the confidence value from a pattern
 */
export function getPatternConfidence(pattern: CommandPattern): number {
  try {
    return pattern.metadata?.confidence ?? 0.5;
  } catch (error) {
    logger.error('Failed to get pattern confidence', { error, pattern });
    return 0.5;
  }
}

/**
 * Update the confidence of a pattern
 */
export function updatePatternConfidence(pattern: CommandPattern, confidence: number): void {
  try {
    if (!pattern.metadata) {
      pattern.metadata = {
        confidence: 0.5,
        updateTimestamp: Date.now(),
        createdTimestamp: Date.now(),
        usageCount: 0
      };
    }
    pattern.metadata.confidence = confidence;
    pattern.metadata.updateTimestamp = Date.now();
  } catch (error) {
    logger.error('Failed to update pattern confidence', { error, pattern, confidence });
  }
}

/**
 * Apply confidence decay to a pattern
 */
export function applyConfidenceDecay(pattern: CommandPattern, decayRate: number = 0.95): void {
  try {
    const currentConfidence = getPatternConfidence(pattern);
    const newConfidence = currentConfidence * decayRate;
    updatePatternConfidence(pattern, newConfidence);
  } catch (error) {
    logger.error('Failed to apply confidence decay', { error, pattern, decayRate });
  }
}

/**
 * Compare two patterns for similarity
 */
export function comparePatterns(patternA: string, patternB: string): number {
  const partsA = patternA.split(' ');
  const partsB = patternB.split(' ');
  
  if (partsA.length !== partsB.length) {
    return 0;
  }
  
  let matches = 0;
  for (let i = 0; i < partsA.length; i++) {
    const a = partsA[i];
    const b = partsB[i];
    
    // Both are parameters
    if (a && b && a.startsWith('{') && a.endsWith('}') && b.startsWith('{') && b.endsWith('}')) {
      matches += 0.8;
    }
    // Both are the same word
    else if (a === b) {
      matches += 1;
    }
  }
  
  return matches / partsA.length;
}

/**
 * Extract parameters from a command pattern
 */
export function extractParameters(pattern: string): string[] {
  const parts = pattern.split(' ');
  return parts
    .filter(part => part.startsWith('{') && part.endsWith('}'))
    .map(part => part.slice(1, -1));
}

/**
 * Normalize a pattern by ensuring consistent parameter naming
 */
export function normalizePattern(pattern: string): string {
  const parts = pattern.split(' ');
  const params: Record<string, number> = {};
  
  return parts.map(part => {
    if (part.startsWith('{') && part.endsWith('}')) {
      const paramName = part.slice(1, -1);
      if (!params[paramName]) {
        params[paramName] = Object.keys(params).length + 1;
      }
      return `{param${params[paramName]}}`;
    }
    return part;
  }).join(' ');
} 