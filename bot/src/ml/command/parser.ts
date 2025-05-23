import { 
  MLCommandParser, 
  IntentClassification, 
  SimilarCommand, 
  ErrorPrediction,
  CommandPattern,
  CommandContext
} from '@/types/ml/command';
import { TaskContext } from  '@/llm/types';
import { LLMClient } from '../../utils/llmClient';
import { PatternRecognitionSystem } from './pattern_recognition';
import { Vec3 } from 'vec3';
import { GameStateFactory } from '@/types/ml/gameState';

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

  // Get bot state from the GameStateFactory
  private getBotState() {
    const defaultBotState = GameStateFactory.createDefaultBotState();
    return {
      position: defaultBotState.position,
      health: defaultBotState.health,
      food: defaultBotState.food,
      experience: defaultBotState.experience,
      selectedItem: defaultBotState.selectedItem,
      inventory: defaultBotState.inventory
    };
  }

  private getGameState() {
    return GameStateFactory.createDefaultGameState();
  }

  private async initializeCommandPatterns() {
    // Load predefined command patterns
    const gameState = this.getGameState();
    const { botState, worldState, environment, taskHistory, playerState } = gameState;
    
    const defaultContext = GameStateFactory.createCommandContext();
    
    this.commandPatterns = [
      {
        pattern: "mine {block}",
        intent: "mining",
        parameters: { block: "string" },
        examples: ["mine stone", "mine diamond ore"],
        context: defaultContext
      },
      {
        pattern: "craft {item}",
        intent: "crafting",
        parameters: { item: "string" },
        examples: ["craft pickaxe", "craft sword"],
        context: defaultContext
      },
      {
        pattern: "go to {location}",
        intent: "navigation",
        parameters: { location: "string" },
        examples: ["go to spawn", "go to village"],
        context: defaultContext
      }
    ];
    
    // Initialize pattern recognition with predefined patterns
    this.patternRecognition = new PatternRecognitionSystem(this.llmClient, this.commandPatterns);
  }

  // Implementing required methods from MLCommandParser interface
  async parse(input: string, context: CommandContext): Promise<IntentClassification> {
    return this.classifyIntent(input, context as any);
  }

  async validate(intent: IntentClassification): Promise<boolean> {
    // Simple validation logic
    return intent.confidence > 0.7;
  }

  async suggest(input: string, context: CommandContext): Promise<SimilarCommand[]> {
    return this.findSimilarCommands(input);
  }

  async classifyIntent(command: string, context: TaskContext): Promise<IntentClassification> {
    // Track command in history
    this.trackCommand(command);

    // First try pattern matching
    const patternMatch = this.matchCommandPattern(command);
    const confidence = this.getPatternConfidence(patternMatch);
    
    if (confidence > 0.8) {
      return {
        intent: patternMatch.intent,
        confidence: confidence,
        parameters: patternMatch.parameters,
        context: patternMatch.context
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
        // Ensure examples array is not undefined
        const exampleCommand = pattern.examples && pattern.examples.length > 0 
          ? pattern.examples[0] 
          : pattern.pattern;
          
        similar.push({
          command: exampleCommand || "",
          similarity: match.confidence,
          context: pattern.context
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

    // Default fallback pattern using the factory
    const defaultContext = GameStateFactory.createCommandContext();

    const defaultPattern: CommandPattern = {
      pattern: "",
      intent: "unknown",
      parameters: {},
      examples: [],
      context: defaultContext
    };

    return bestMatch || defaultPattern;
  }

  private getPatternConfidence(pattern: CommandPattern): number {
    // Custom logic to determine pattern confidence
    // Using a default value for patterns without explicit confidence
    return 0.8;
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
      const patternPart = patternParts[i];
      const commandPart = commandParts[i];
      
      if (patternPart && commandPart) {
        if (patternPart.startsWith("{") && patternPart.endsWith("}")) {
          const paramName = patternPart.slice(1, -1);
          parameters[paramName] = commandPart;
          matches++;
        } else if (patternPart === commandPart) {
          matches++;
        }
      }
    }

    // Calculate confidence based on the match ratio
    const confidence = matches / patternParts.length;
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
- context: Command context information
`;
  }

  private generateSimilarityPrompt(command: string): string {
    return `
Find similar commands to: "${command}"
Return a JSON array of similar commands with:
- command: The similar command
- similarity: Similarity score (0-1)
- context: Command context information
`;
  }

  private generateErrorPredictionPrompt(command: string, context: TaskContext): string {
    return `
Predict potential errors for the command: "${command}"
Context: ${JSON.stringify(context, null, 2)}

Return a JSON object with:
- type: Error type
- probability: Error probability (0-1)
- context: Command context information
- suggestedFix: Suggested fix for the error
`;
  }

  private parseClassificationResponse(response: string): IntentClassification {
    try {
      return JSON.parse(response);
    } catch (error) {
      // Use GameStateFactory for default context when parsing fails
      const defaultContext = GameStateFactory.createCommandContext();
      
      return {
        intent: "unknown",
        confidence: 0,
        parameters: {},
        context: defaultContext
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
      // Use GameStateFactory for default context when parsing fails
      const defaultContext = GameStateFactory.createCommandContext();
      
      return {
        type: "unknown",
        probability: 0,
        context: defaultContext,
        suggestedFix: "Unable to determine a fix"
      };
    }
  }
} 