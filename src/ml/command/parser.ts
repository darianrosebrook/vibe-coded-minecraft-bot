import { 
  MLCommandParser, 
  IntentClassification, 
  SimilarCommand, 
  ErrorPrediction,
  CommandPattern,
  CommandContext
} from '@/types';
import { TaskContext } from '@/types';
import { LLMClient } from '../../utils/llmClient';
import { PatternRecognitionSystem } from './pattern_recognition';

export class MLCommandParserImpl implements MLCommandParser {
  private llmClient: LLMClient;
  private commandPatterns: CommandPattern[] = [];
  private historicalCommands: Map<string, number> = new Map();
  private patternRecognition: PatternRecognitionSystem;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
    this.patternRecognition = new PatternRecognitionSystem(llmClient);
    this.initializeCommandPatterns();
  }

  private async initializeCommandPatterns() {
    // Load predefined command patterns
    this.commandPatterns = [
      {
        pattern: "mine {block}",
        intent: "mining",
        parameters: { block: "string" },
        examples: ["mine stone", "mine diamond ore"],
        confidence: 0.9
      },
      {
        pattern: "craft {item}",
        intent: "crafting",
        parameters: { item: "string" },
        examples: ["craft pickaxe", "craft sword"],
        confidence: 0.9
      },
      {
        pattern: "go to {location}",
        intent: "navigation",
        parameters: { location: "string" },
        examples: ["go to spawn", "go to village"],
        confidence: 0.9
      }
    ];
    
    // Initialize pattern recognition with predefined patterns
    this.patternRecognition = new PatternRecognitionSystem(this.llmClient, this.commandPatterns);
  }

  async classifyIntent(command: string, context: TaskContext): Promise<IntentClassification> {
    // Track command in history
    this.trackCommand(command);

    // First try pattern matching
    const patternMatch = this.matchCommandPattern(command);
    if (patternMatch.confidence > 0.8) {
      return {
        intent: patternMatch.intent,
        confidence: patternMatch.confidence,
        parameters: patternMatch.parameters,
        alternatives: []
      };
    }

    // If pattern matching fails, use LLM
    const prompt = this.generateClassificationPrompt(command, context);
    const response = await this.llmClient.generate(prompt);
    
    const classification = this.parseClassificationResponse(response);
    
    // If classification was successful, learn from it
    if (classification.confidence > 0.7) {
      await this.patternRecognition.learnFromSuccessfulPatterns([command]);
    }
    
    return classification;
  }

  async findSimilarCommands(command: string): Promise<SimilarCommand[]> {
    // First try to find similar commands from patterns
    const patternBasedSimilar = this.findSimilarFromPatterns(command);
    if (patternBasedSimilar.length > 0) {
      return patternBasedSimilar;
    }

    // If no pattern matches, use LLM
    const prompt = this.generateSimilarityPrompt(command);
    const response = await this.llmClient.generate(prompt);
    
    return this.parseSimilarCommandsResponse(response);
  }

  private findSimilarFromPatterns(command: string): SimilarCommand[] {
    const similar: SimilarCommand[] = [];
    const allPatterns = [...this.commandPatterns, ...this.patternRecognition.getPatterns()];
    
    for (const pattern of allPatterns) {
      const match = this.matchPattern(command, pattern);
      if (match.confidence > 0.6) {
        similar.push({
          command: pattern.examples[0],
          similarity: match.confidence,
          intent: pattern.intent,
          parameters: match.parameters
        });
      }
    }
    
    return similar;
  }

  async predictError(command: string, context: TaskContext): Promise<ErrorPrediction> {
    const prompt = this.generateErrorPredictionPrompt(command, context);
    const response = await this.llmClient.generate(prompt);
    
    return this.parseErrorPredictionResponse(response);
  }

  private trackCommand(command: string): void {
    const count = this.historicalCommands.get(command) || 0;
    this.historicalCommands.set(command, count + 1);
  }

  private matchCommandPattern(command: string): CommandPattern {
    // Get patterns from both predefined and learned sources
    const allPatterns = [...this.commandPatterns, ...this.patternRecognition.getPatterns()];
    
    let bestMatch: CommandPattern | null = null;
    let highestConfidence = 0;

    for (const pattern of allPatterns) {
      const match = this.matchPattern(command, pattern);
      if (match.confidence > highestConfidence) {
        bestMatch = pattern;
        highestConfidence = match.confidence;
      }
    }

    return bestMatch || {
      pattern: "",
      intent: "unknown",
      parameters: {},
      examples: [],
      confidence: 0
    };
  }

  private matchPattern(command: string, pattern: CommandPattern): { confidence: number; parameters: Record<string, any> } {
    const patternParts = pattern.pattern.split(" ");
    const commandParts = command.split(" ");

    if (patternParts.length !== commandParts.length) {
      return { confidence: 0, parameters: {} };
    }

    const parameters: Record<string, any> = {};
    let matches = 0;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith("{") && patternParts[i].endsWith("}")) {
        const paramName = patternParts[i].slice(1, -1);
        parameters[paramName] = commandParts[i];
        matches++;
      } else if (patternParts[i] === commandParts[i]) {
        matches++;
      }
    }

    const confidence = (matches / patternParts.length) * pattern.confidence;
    return { confidence, parameters };
  }

  private generateClassificationPrompt(command: string, context: TaskContext): string {
    return `
Given the following command and context:
Command: "${command}"
Context: ${JSON.stringify(context, null, 2)}

Classify the intent and extract parameters. Return a JSON object with:
- intent: The primary intent of the command
- confidence: Confidence score (0-1)
- parameters: Extracted parameters
- alternatives: Alternative interpretations with confidence scores
`;
  }

  private generateSimilarityPrompt(command: string): string {
    return `
Find similar commands to: "${command}"
Return a JSON array of similar commands with:
- command: The similar command
- similarity: Similarity score (0-1)
- intent: The command's intent
- parameters: Extracted parameters
`;
  }

  private generateErrorPredictionPrompt(command: string, context: TaskContext): string {
    return `
Predict potential errors for the command: "${command}"
Context: ${JSON.stringify(context, null, 2)}

Return a JSON object with:
- likelihood: Overall error likelihood (0-1)
- potentialErrors: Array of potential errors with:
  - type: Error type
  - description: Error description
  - severity: Error severity (low/medium/high)
  - preventionSteps: Steps to prevent the error
`;
  }

  private parseClassificationResponse(response: string): IntentClassification {
    try {
      return JSON.parse(response);
    } catch (error) {
      return {
        intent: "unknown",
        confidence: 0,
        parameters: {},
        alternatives: []
      };
    }
  }

  private parseSimilarCommandsResponse(response: string): SimilarCommand[] {
    try {
      return JSON.parse(response);
    } catch (error) {
      return [];
    }
  }

  private parseErrorPredictionResponse(response: string): ErrorPrediction {
    try {
      return JSON.parse(response);
    } catch (error) {
      return {
        likelihood: 0,
        potentialErrors: []
      };
    }
  }
} 