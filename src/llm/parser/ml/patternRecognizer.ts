import { TaskContext } from '../types';

export class PatternRecognizer {
  private readonly patterns: Array<{
    name: string;
    pattern: RegExp;
    confidence: number;
    examples: string[];
  }> = [
    {
      name: 'mining_command',
      pattern: /(?:mine|dig)\s+(?:some|a|the)?\s*(?:diamond|iron|gold|coal|redstone|lapis|emerald|quartz)\s+ore/i,
      confidence: 0.9,
      examples: ['mine some diamond ore', 'dig iron ore']
    },
    {
      name: 'crafting_command',
      pattern: /(?:craft|make|create)\s+(?:a|an|some)?\s*(?:wooden|stone|iron|gold|diamond)?\s*(?:pickaxe|axe|sword|shovel|hoe)/i,
      confidence: 0.9,
      examples: ['craft a wooden pickaxe', 'make an iron sword']
    },
    {
      name: 'navigation_command',
      pattern: /(?:go|move|travel)\s+(?:to|towards)?\s*(?:me|here|there|that|this)?/i,
      confidence: 0.8,
      examples: ['go to me', 'come here']
    },
    {
      name: 'inventory_command',
      pattern: /(?:check|show|what)\s+(?:do|does)?\s*(?:i|you)\s+(?:have|carry)/i,
      confidence: 0.8,
      examples: ['what do you have', 'check inventory']
    },
    {
      name: 'query_command',
      pattern: /(?:what|where|when|how|why)\s+(?:is|are|do|does|can|could|should|would)/i,
      confidence: 0.7,
      examples: ['what is that', 'where are you']
    },
    {
      name: 'combat_command',
      pattern: /(?:attack|fight|kill)\s+(?:that|this|the)?\s*(?:mob|monster|enemy)/i,
      confidence: 0.8,
      examples: ['attack that mob', 'kill the monster']
    },
    {
      name: 'farming_command',
      pattern: /(?:farm|plant|harvest)\s+(?:some|a|the)?\s*(?:wheat|carrot|potato|beetroot)/i,
      confidence: 0.8,
      examples: ['plant some wheat', 'harvest carrots']
    },
    {
      name: 'building_command',
      pattern: /(?:build|construct)\s+(?:a|an|some)?\s*(?:house|shelter|base|structure)/i,
      confidence: 0.8,
      examples: ['build a house', 'construct a shelter']
    }
  ];

  public async recognize(command: string): Promise<boolean> {
    return this.patterns.some(pattern => pattern.pattern.test(command));
  }

  public async getPatternMatch(
    command: string
  ): Promise<{
    name: string;
    confidence: number;
    examples: string[];
  } | null> {
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(command)) {
        return {
          name: pattern.name,
          confidence: pattern.confidence,
          examples: pattern.examples
        };
      }
    }
    return null;
  }

  public async getConfidence(command: string): Promise<number> {
    const match = await this.getPatternMatch(command);
    return match?.confidence || 0;
  }

  public async train(
    commands: string[],
    patterns: Array<{
      name: string;
      pattern: string;
      confidence: number;
      examples: string[];
    }>
  ): Promise<void> {
    // Implement training logic here
    // This would typically involve:
    // 1. Pattern extraction
    // 2. Confidence calculation
    // 3. Example collection
    // For now, we'll use the predefined patterns
  }

  public async evaluate(
    command: string,
    context: TaskContext
  ): Promise<{
    matched: boolean;
    pattern?: {
      name: string;
      confidence: number;
      examples: string[];
    } | null;
  }> {
    const matched = await this.recognize(command);
    const pattern = matched ? await this.getPatternMatch(command) : undefined;

    return {
      matched,
      pattern: pattern || null
    };
  }
} 