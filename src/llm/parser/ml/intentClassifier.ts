import { TaskContext } from '@/types';

export class MLIntentClassifier {
  private readonly intents = [
    'mining',
    'crafting',
    'navigation',
    'inventory',
    'query',
    'combat',
    'farming',
    'building'
  ];

  private readonly intentPatterns: Record<string, RegExp[]> = {
    mining: [
      /mine|dig|extract|gather|collect/i,
      /(?:diamond|iron|gold|coal|redstone|lapis|emerald|quartz)\s+ore/i
    ],
    crafting: [
      /craft|make|create|build|forge/i,
      /(?:pickaxe|axe|sword|shovel|hoe|armor|tool)/i
    ],
    navigation: [
      /go|move|travel|walk|run|come|follow/i,
      /(?:to|towards|near|close|far|away)/i
    ],
    inventory: [
      /inventory|items|have|carry|equip|wear/i,
      /(?:check|show|display|list|count)/i
    ],
    query: [
      /what|where|when|how|why|which/i,
      /(?:tell|show|find|locate|search)/i
    ],
    combat: [
      /fight|attack|kill|defend|protect/i,
      /(?:mob|monster|enemy|creature)/i
    ],
    farming: [
      /farm|plant|grow|harvest|collect/i,
      /(?:wheat|carrot|potato|beetroot|crop)/i
    ],
    building: [
      /build|construct|place|put|make/i,
      /(?:house|shelter|base|structure|wall)/i
    ]
  };

  public async classify(command: string): Promise<string> {
    // Check for exact matches first
    for (const intent of this.intents) {
      if (command.toLowerCase().includes(intent)) {
        return intent;
      }
    }

    // Check patterns
    let bestMatch = 'unknown';
    let highestScore = 0;

    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(command)) {
          score += 1;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = intent;
      }
    }

    return bestMatch;
  }

  public getConfidence(intent: string): number {
    // Simple confidence scoring based on intent patterns
    const patterns = this.intentPatterns[intent] || [];
    return patterns.length > 0 ? 0.8 : 0.5;
  }

  public async train(commands: string[], intents: string[]): Promise<void> {
    // Implement training logic here
    // This would typically involve:
    // 1. Feature extraction
    // 2. Model training
    // 3. Pattern optimization
    // For now, we'll use the predefined patterns
  }

  public async evaluate(command: string, context: TaskContext): Promise<{
    intent: string;
    confidence: number;
    alternatives: string[];
  }> {
    const intent = await this.classify(command);
    const confidence = this.getConfidence(intent);
    
    // Get alternative intents based on confidence
    const alternatives = confidence < 0.7
      ? this.intents.filter(i => i !== intent)
      : [];

    return {
      intent,
      confidence,
      alternatives
    };
  }
} 