import { LLMClient } from '../../utils/llmClient';
import { patternStore } from './pattern_store';
import { PatternRecognitionSystem } from './pattern_recognition';
import { CommandPattern } from '@/types/ml/command';

/**
 * Factory for creating PatternRecognitionSystem instances
 */
export class PatternFactory {
  /**
   * Create a new PatternRecognitionSystem with initialized patterns
   */
  static createPatternRecognitionSystem(llmClient: LLMClient): PatternRecognitionSystem {
    return new PatternRecognitionSystem(llmClient, true);
  }
  
  /**
   * Get the global pattern store
   */
  static getPatternStore() {
    return patternStore;
  }
  
  /**
   * Reset the pattern store to default patterns
   */
  static resetPatternStore(): CommandPattern[] {
    const patterns = patternStore.getPatterns();
    
    for (const pattern of patterns) {
      patternStore.removePattern(pattern);
    }
    
    // This will trigger re-initialization with defaults in the PatternStore
    return patternStore.getPatterns();
  }
}

// Provide a simpler way to create a pattern recognition system
export function createPatternSystem(llmClient: LLMClient): PatternRecognitionSystem {
  return PatternFactory.createPatternRecognitionSystem(llmClient);
} 