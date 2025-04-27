import { CommandPattern } from './types';
import { LLMClient } from '../../utils/llmClient';
import { TaskContext } from '../../llm/types';

interface CommandGroup {
  commands: string[];
  intent: string;
  structure: string;
  parameters: string[];
}

interface CommandSequence {
  sequence: string[];
  frequency: number;
  confidence: number;
  context: Record<string, any>;
}

interface CommandSuggestion {
  command: string;
  confidence: number;
  context: Record<string, any>;
  reason: string;
}

interface SequenceError {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  preventionSteps: string[];
  confidence: number;
}

interface ErrorPrevention {
  error: SequenceError;
  prevention: string[];
  confidence: number;
}

export class PatternRecognitionSystem {
  private commandPatterns: CommandPattern[] = [];
  private commandSequences: Map<string, CommandSequence> = new Map();
  private patternConfidenceDecay: number = 0.95; // 5% decay per time period
  private sequenceConfidenceDecay: number = 0.9; // 10% decay per time period
  private llmClient: LLMClient;
  private commandGroups: Map<string, CommandGroup> = new Map();
  private recentCommands: string[] = [];
  private maxRecentCommands: number = 10;
  private suggestionThreshold: number = 0.7;
  private errorHistory: Map<string, number> = new Map();

  constructor(llmClient: LLMClient, initialPatterns: CommandPattern[] = []) {
    this.llmClient = llmClient;
    this.commandPatterns = initialPatterns;
  }

  private matchCommandPattern(command: string): CommandPattern {
    let bestMatch: CommandPattern | null = null;
    let highestConfidence = 0;

    for (const pattern of this.commandPatterns) {
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

  public async getCommandSuggestions(context: TaskContext): Promise<CommandSuggestion[]> {
    const suggestions: CommandSuggestion[] = [];
    
    // 1. Suggest based on recent commands
    if (this.recentCommands.length > 0) {
      const lastCommand = this.recentCommands[this.recentCommands.length - 1];
      const nextCommands = await this.predictNextCommand(lastCommand, context);
      
      for (const command of nextCommands) {
        suggestions.push({
          command,
          confidence: 0.8,
          context: { type: 'sequence', lastCommand },
          reason: 'Common sequence continuation'
        });
      }
    }

    // 2. Suggest based on common patterns
    for (const pattern of this.commandPatterns) {
      if (pattern.confidence > this.suggestionThreshold) {
        suggestions.push({
          command: pattern.examples[0],
          confidence: pattern.confidence,
          context: { type: 'pattern', intent: pattern.intent },
          reason: 'Common command pattern'
        });
      }
    }

    // 3. Suggest based on context
    const contextSuggestions = await this.generateContextSuggestions(context);
    suggestions.push(...contextSuggestions);

    // 4. Optimize suggestions
    return this.optimizeSuggestions(suggestions);
  }

  private async generateContextSuggestions(context: TaskContext): Promise<CommandSuggestion[]> {
    const prompt = `
Given the following Minecraft context:
${JSON.stringify(context, null, 2)}

Suggest relevant commands that would be useful in this context.
Consider:
1. Current resources and needs
2. Common tasks in this situation
3. Recent player actions
4. Environment state

Return a JSON array of suggestions with:
- command: The suggested command
- confidence: Confidence score (0-1)
- reason: Why this command is suggested
`;
    
    try {
      const response = await this.llmClient.generate(prompt);
      return JSON.parse(response);
    } catch (error) {
      return [];
    }
  }

  private optimizeSuggestions(suggestions: CommandSuggestion[]): CommandSuggestion[] {
    // Remove duplicates
    const uniqueSuggestions = new Map<string, CommandSuggestion>();
    for (const suggestion of suggestions) {
      const existing = uniqueSuggestions.get(suggestion.command);
      if (!existing || existing.confidence < suggestion.confidence) {
        uniqueSuggestions.set(suggestion.command, suggestion);
      }
    }

    // Sort by confidence
    return Array.from(uniqueSuggestions.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Return top 5 suggestions
  }

  public async optimizeCommandSequence(sequence: string[], context: TaskContext): Promise<string[]> {
    const prompt = `
Given this sequence of Minecraft commands:
${sequence.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}

Context: ${JSON.stringify(context, null, 2)}

Optimize this sequence by:
1. Removing redundant commands
2. Reordering for efficiency
3. Combining related commands
4. Adding missing steps

Return a JSON array of the optimized command sequence.
`;
    
    try {
      const response = await this.llmClient.generate(prompt);
      return JSON.parse(response);
    } catch (error) {
      return sequence; // Return original sequence if optimization fails
    }
  }

  public addCommandSequence(sequence: string[]): void {
    const sequenceKey = sequence.join(' -> ');
    const existing = this.commandSequences.get(sequenceKey);
    
    if (existing) {
      existing.frequency++;
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    } else {
      this.commandSequences.set(sequenceKey, {
        sequence,
        frequency: 1,
        confidence: 0.7,
        context: this.extractSequenceContext(sequence)
      });
    }
  }

  public async learnFromCommand(command: string, context: TaskContext): Promise<void> {
    // Add command to recent history
    this.recentCommands.push(command);
    if (this.recentCommands.length > this.maxRecentCommands) {
      this.recentCommands.shift();
    }

    // If we have enough commands, try to learn sequences
    if (this.recentCommands.length >= 2) {
      await this.analyzeRecentSequences(context);
    }

    // Learn from the individual command
    await this.learnFromSuccessfulPatterns([command]);
  }

  private async analyzeRecentSequences(context: TaskContext): Promise<void> {
    // Analyze all possible sequences in recent commands
    for (let i = 2; i <= this.recentCommands.length; i++) {
      const sequence = this.recentCommands.slice(-i);
      const sequenceKey = sequence.join(' -> ');
      
      // Check if this sequence makes sense
      const isValid = await this.validateSequence(sequence, context);
      if (isValid) {
        this.addCommandSequence(sequence);
      }
    }
  }

  private async validateSequence(sequence: string[], context: TaskContext): Promise<boolean> {
    const prompt = `
Given this sequence of Minecraft commands:
${sequence.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}

Context: ${JSON.stringify(context, null, 2)}

Does this sequence make logical sense? Consider:
1. Are the commands related?
2. Do they form a coherent task?
3. Is the order logical?

Respond with "true" or "false".
`;
    
    const response = await this.llmClient.generate(prompt);
    return response.trim().toLowerCase() === 'true';
  }

  private extractSequenceContext(sequence: string[]): Record<string, any> {
    const context: Record<string, any> = {
      intents: [],
      parameters: new Set<string>(),
      patterns: []
    };

    for (const command of sequence) {
      const pattern = this.matchCommandPattern(command);
      if (pattern.intent !== 'unknown') {
        context.intents.push(pattern.intent);
        context.patterns.push(pattern.pattern);
        Object.keys(pattern.parameters).forEach(param => context.parameters.add(param));
      }
    }

    return {
      ...context,
      parameters: Array.from(context.parameters)
    };
  }

  public identifyCommonSequences(): string[][] {
    const threshold = 3; // Minimum occurrences to be considered common
    const commonSequences: string[][] = [];

    for (const [sequence, data] of this.commandSequences.entries()) {
      if (data.frequency >= threshold && data.confidence > 0.6) {
        commonSequences.push(sequence.split(' -> '));
      }
    }

    return commonSequences;
  }

  public async predictNextCommand(currentCommand: string, context: TaskContext): Promise<string[]> {
    const predictions: string[] = [];
    const currentPattern = this.matchCommandPattern(currentCommand);

    // Find sequences that start with the current command
    for (const [sequence, data] of this.commandSequences.entries()) {
      const commands = sequence.split(' -> ');
      if (commands[0] === currentCommand && data.confidence > 0.7) {
        predictions.push(commands[1]);
      }
    }

    // If no sequences found, use LLM to predict
    if (predictions.length === 0) {
      const prompt = `
Given the current Minecraft command: "${currentCommand}"
Context: ${JSON.stringify(context, null, 2)}

Predict the next most likely command. Consider:
1. Common Minecraft task sequences
2. Current context and goals
3. Previous command patterns

Return a JSON array of possible next commands.
`;
      
      const response = await this.llmClient.generate(prompt);
      try {
        const predictedCommands = JSON.parse(response);
        predictions.push(...predictedCommands);
      } catch (error) {
        // If parsing fails, return empty array
      }
    }

    return predictions;
  }

  public async learnFromSuccessfulPatterns(successfulCommands: string[]): Promise<void> {
    // Group commands using multiple strategies
    const groupedCommands = await this.groupCommands(successfulCommands);
    
    // Analyze patterns from groups
    const newPatterns = await this.analyzeCommandPatterns(groupedCommands);
    
    // Update existing patterns or add new ones
    for (const newPattern of newPatterns) {
      const existingPattern = this.commandPatterns.find(
        p => p.pattern === newPattern.pattern
      );

      if (existingPattern) {
        // Update confidence based on success
        existingPattern.confidence = Math.min(
          1.0,
          existingPattern.confidence + 0.1
        );
      } else {
        // Add new pattern with initial confidence
        this.commandPatterns.push({
          ...newPattern,
          confidence: 0.7
        });
      }
    }

    // Apply confidence decay to all patterns and sequences
    this.decayPatternConfidence();
    this.decaySequenceConfidence();
  }

  private decaySequenceConfidence(): void {
    for (const [key, sequence] of this.commandSequences.entries()) {
      sequence.confidence *= this.sequenceConfidenceDecay;
      
      // Remove sequences with very low confidence
      if (sequence.confidence < 0.1) {
        this.commandSequences.delete(key);
      }
    }
  }

  private async groupCommands(commands: string[]): Promise<CommandGroup[]> {
    const groups: CommandGroup[] = [];
    
    // First pass: Group by structure
    const structureGroups = this.groupByStructure(commands);
    
    // Second pass: Refine groups using semantic similarity
    for (const [structure, groupCommands] of structureGroups.entries()) {
      if (groupCommands.length > 1) {
        const semanticGroups = await this.groupBySemanticSimilarity(groupCommands);
        groups.push(...semanticGroups);
      } else {
        // Single command group
        const command = groupCommands[0];
        groups.push({
          commands: [command],
          intent: await this.detectIntent(command),
          structure,
          parameters: this.extractParameters(command)
        });
      }
    }
    
    return groups;
  }

  private groupByStructure(commands: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    
    for (const command of commands) {
      const structure = this.getCommandStructure(command);
      const group = groups.get(structure) || [];
      group.push(command);
      groups.set(structure, group);
    }
    
    return groups;
  }

  private getCommandStructure(command: string): string {
    const words = command.split(' ');
    return words.map(word => {
      // Replace parameters with placeholders
      if (this.isParameter(word)) {
        return '{param}';
      }
      return word;
    }).join(' ');
  }

  private isParameter(word: string): boolean {
    // Simple heuristic: words that are not common Minecraft terms
    const commonTerms = new Set([
      'mine', 'craft', 'build', 'go', 'to', 'the', 'and', 'with',
      'using', 'for', 'in', 'at', 'on', 'by', 'from'
    ]);
    
    return !commonTerms.has(word.toLowerCase());
  }

  private async groupBySemanticSimilarity(commands: string[]): Promise<CommandGroup[]> {
    const groups: CommandGroup[] = [];
    const processed = new Set<string>();
    
    for (const command of commands) {
      if (processed.has(command)) continue;
      
      const group: CommandGroup = {
        commands: [command],
        intent: await this.detectIntent(command),
        structure: this.getCommandStructure(command),
        parameters: this.extractParameters(command)
      };
      
      // Find similar commands
      for (const otherCommand of commands) {
        if (command === otherCommand || processed.has(otherCommand)) continue;
        
        const similarity = await this.calculateSimilarity(command, otherCommand);
        if (similarity > 0.7) { // Similarity threshold
          group.commands.push(otherCommand);
          processed.add(otherCommand);
        }
      }
      
      groups.push(group);
      processed.add(command);
    }
    
    return groups;
  }

  private async detectIntent(command: string): Promise<string> {
    const prompt = `
Given the Minecraft command: "${command}"
What is the primary intent of this command? Respond with just the intent word.
Examples:
- "mine diamond" -> "mining"
- "craft sword" -> "crafting"
- "go to village" -> "navigation"
`;
    
    const response = await this.llmClient.generate(prompt);
    return response.trim().toLowerCase();
  }

  private async calculateSimilarity(command1: string, command2: string): Promise<number> {
    const prompt = `
Calculate the semantic similarity between these two Minecraft commands:
1. "${command1}"
2. "${command2}"

Return a number between 0 and 1 representing their similarity.
Consider:
- Intent similarity
- Parameter similarity
- Context similarity
`;
    
    const response = await this.llmClient.generate(prompt);
    return parseFloat(response) || 0;
  }

  private extractParameters(command: string): string[] {
    const words = command.split(' ');
    return words.filter(word => this.isParameter(word));
  }

  private async analyzeCommandPatterns(groups: CommandGroup[]): Promise<CommandPattern[]> {
    const patterns: CommandPattern[] = [];
    
    for (const group of groups) {
      if (group.commands.length >= 2) {
        const pattern = await this.createPatternFromGroup(group);
        patterns.push(pattern);
      }
    }
    
    return patterns;
  }

  private async createPatternFromGroup(group: CommandGroup): Promise<CommandPattern> {
    const patternParts = group.structure.split(' ');
    const parameters: Record<string, string> = {};
    
    // Extract parameter types from examples
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '{param}') {
        const paramName = `param${i}`;
        parameters[paramName] = await this.determineParameterType(
          group.commands.map(c => c.split(' ')[i])
        );
      }
    }
    
    return {
      pattern: group.structure,
      intent: group.intent,
      parameters,
      examples: group.commands.slice(0, 3),
      confidence: Math.min(0.9, 0.7 + (group.commands.length * 0.1))
    };
  }

  private async determineParameterType(values: string[]): Promise<string> {
    const prompt = `
Given these Minecraft parameter values: ${JSON.stringify(values)}
What type are they? Choose from:
- block
- item
- location
- number
- string
- entity
- direction
- color
- material
- tool
- armor
- food
- potion
- enchantment
- biome
- dimension
- structure
- mob
- player
- team
- scoreboard
- objective
- tag
- nbt
- selector
- coordinate
- rotation
- gamemode
- difficulty
- weather
- time
- effect
- particle
- sound
- advancement
- recipe
- loot_table
- function
- datapack
- resource
- advancement
- recipe
- loot_table
- function
- datapack
- resource
`;
    
    const response = await this.llmClient.generate(prompt);
    return response.trim().toLowerCase();
  }

  private decayPatternConfidence(): void {
    for (const pattern of this.commandPatterns) {
      pattern.confidence *= this.patternConfidenceDecay;
      
      // Remove patterns with very low confidence
      if (pattern.confidence < 0.1) {
        this.commandPatterns = this.commandPatterns.filter(p => p !== pattern);
      }
    }
  }

  public getPatterns(): CommandPattern[] {
    return this.commandPatterns;
  }

  public async predictSequenceErrors(sequence: string[], context: TaskContext): Promise<SequenceError[]> {
    const errors: SequenceError[] = [];
    
    // 1. Check for known error patterns
    const knownErrors = await this.checkKnownErrorPatterns(sequence);
    errors.push(...knownErrors);

    // 2. Analyze sequence for potential issues
    const potentialErrors = await this.analyzeSequenceForErrors(sequence, context);
    errors.push(...potentialErrors);

    // 3. Check for resource conflicts
    const resourceErrors = await this.checkResourceConflicts(sequence, context);
    errors.push(...resourceErrors);

    // 4. Validate command dependencies
    const dependencyErrors = await this.validateCommandDependencies(sequence);
    errors.push(...dependencyErrors);

    // Sort errors by severity and confidence
    return errors.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      return severityDiff !== 0 ? severityDiff : b.confidence - a.confidence;
    });
  }

  private async checkKnownErrorPatterns(sequence: string[]): Promise<SequenceError[]> {
    const errors: SequenceError[] = [];
    const sequenceKey = sequence.join(' -> ');

    // Check error history
    const errorCount = this.errorHistory.get(sequenceKey) || 0;
    if (errorCount > 0) {
      errors.push({
        type: 'historical',
        description: `This sequence has failed ${errorCount} times before`,
        severity: errorCount > 2 ? 'high' : 'medium',
        preventionSteps: ['Consider alternative sequence', 'Add error handling'],
        confidence: Math.min(0.9, errorCount * 0.3)
      });
    }

    // Check for common error patterns
    const prompt = `
Given this sequence of Minecraft commands:
${sequence.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}

Identify any known error patterns or common mistakes.
Return a JSON array of errors with:
- type: Error type
- description: Error description
- severity: Error severity (low/medium/high)
- preventionSteps: Steps to prevent the error
- confidence: Confidence score (0-1)
`;
    
    try {
      const response = await this.llmClient.generate(prompt);
      const knownErrors = JSON.parse(response);
      errors.push(...knownErrors);
    } catch (error) {
      // If parsing fails, continue with other checks
    }

    return errors;
  }

  private async analyzeSequenceForErrors(sequence: string[], context: TaskContext): Promise<SequenceError[]> {
    const prompt = `
Given this sequence of Minecraft commands:
${sequence.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}

Context: ${JSON.stringify(context, null, 2)}

Analyze the sequence for potential errors. Consider:
1. Command order issues
2. Missing prerequisites
3. Timing problems
4. Resource availability
5. Environment state

Return a JSON array of potential errors with:
- type: Error type
- description: Error description
- severity: Error severity (low/medium/high)
- preventionSteps: Steps to prevent the error
- confidence: Confidence score (0-1)
`;
    
    try {
      const response = await this.llmClient.generate(prompt);
      return JSON.parse(response);
    } catch (error) {
      return [];
    }
  }

  private async checkResourceConflicts(sequence: string[], context: TaskContext): Promise<SequenceError[]> {
    const prompt = `
Given this sequence of Minecraft commands:
${sequence.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}

Context: ${JSON.stringify(context, null, 2)}

Check for resource conflicts. Consider:
1. Resource requirements
2. Resource availability
3. Resource dependencies
4. Resource timing

Return a JSON array of resource conflicts with:
- type: Resource conflict type
- description: Conflict description
- severity: Conflict severity (low/medium/high)
- preventionSteps: Steps to prevent the conflict
- confidence: Confidence score (0-1)
`;
    
    try {
      const response = await this.llmClient.generate(prompt);
      return JSON.parse(response);
    } catch (error) {
      return [];
    }
  }

  private async validateCommandDependencies(sequence: string[]): Promise<SequenceError[]> {
    const errors: SequenceError[] = [];
    
    // Check each command's dependencies
    for (let i = 0; i < sequence.length; i++) {
      const command = sequence[i];
      const previousCommands = sequence.slice(0, i);
      
      const prompt = `
Given this Minecraft command: "${command}"
And these previous commands: ${previousCommands.join(', ')}

Check if all dependencies are satisfied. Consider:
1. Required previous actions
2. Required resources
3. Required environment state
4. Required player state

Return a JSON array of missing dependencies with:
- type: Dependency type
- description: Missing dependency description
- severity: Dependency severity (low/medium/high)
- preventionSteps: Steps to satisfy the dependency
- confidence: Confidence score (0-1)
`;
      
      try {
        const response = await this.llmClient.generate(prompt);
        const dependencyErrors = JSON.parse(response);
        errors.push(...dependencyErrors);
      } catch (error) {
        // If parsing fails, continue with next command
      }
    }
    
    return errors;
  }

  public async getErrorPrevention(sequence: string[], context: TaskContext): Promise<ErrorPrevention[]> {
    const errors = await this.predictSequenceErrors(sequence, context);
    const preventions: ErrorPrevention[] = [];

    for (const error of errors) {
      const prompt = `
Given this potential error in a Minecraft command sequence:
Type: ${error.type}
Description: ${error.description}
Severity: ${error.severity}

Sequence: ${sequence.join(' -> ')}
Context: ${JSON.stringify(context, null, 2)}

Suggest specific prevention steps. Consider:
1. Command modifications
2. Additional preparation steps
3. Alternative approaches
4. Error handling strategies

Return a JSON object with:
- prevention: Array of prevention steps
- confidence: Confidence in prevention effectiveness (0-1)
`;
      
      try {
        const response = await this.llmClient.generate(prompt);
        const prevention = JSON.parse(response);
        preventions.push({
          error,
          prevention: prevention.prevention,
          confidence: prevention.confidence
        });
      } catch (error) {
        // If parsing fails, continue with next error
      }
    }

    return preventions.sort((a, b) => b.confidence - a.confidence);
  }

  public recordError(sequence: string[]): void {
    const sequenceKey = sequence.join(' -> ');
    const currentCount = this.errorHistory.get(sequenceKey) || 0;
    this.errorHistory.set(sequenceKey, currentCount + 1);
  }
} 