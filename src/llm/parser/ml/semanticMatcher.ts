import { TaskContext } from '@/types';

export class SemanticMatcher {
  private readonly similarityThreshold = 0.7;
  private commandHistory: Array<{
    command: string;
    context: TaskContext;
    timestamp: number;
  }> = [];

  public async getSimilarity(command: string, context: TaskContext): Promise<number> {
    // Add current command to history
    this.commandHistory.push({
      command,
      context,
      timestamp: Date.now()
    });

    // Clean up old history
    this.cleanupHistory();

    // Calculate similarity with recent commands
    const similarities = await Promise.all(
      this.commandHistory
        .filter(entry => entry.command !== command)
        .map(entry => this.calculateSimilarity(command, entry.command))
    );

    // Return highest similarity score
    return similarities.length > 0 ? Math.max(...similarities) : 0;
  }

  private async calculateSimilarity(command1: string, command2: string): Promise<number> {
    // Simple word overlap similarity
    const words1 = new Set(command1.toLowerCase().split(/\s+/));
    const words2 = new Set(command2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private cleanupHistory(): void {
    const oneHourAgo = Date.now() - 3600000; // 1 hour in milliseconds
    this.commandHistory = this.commandHistory.filter(
      entry => entry.timestamp > oneHourAgo
    );
  }

  public async findSimilarCommands(
    command: string,
    threshold: number = this.similarityThreshold
  ): Promise<Array<{
    command: string;
    similarity: number;
    context: TaskContext;
  }>> {
    const similarities = await Promise.all(
      this.commandHistory
        .filter(entry => entry.command !== command)
        .map(async entry => ({
          command: entry.command,
          similarity: await this.calculateSimilarity(command, entry.command),
          context: entry.context
        }))
    );

    return similarities
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);
  }

  public async train(
    commands: string[],
    contexts: TaskContext[],
    similarities: number[]
  ): Promise<void> {
    // Implement training logic here
    // This would typically involve:
    // 1. Feature extraction
    // 2. Model training
    // 3. Threshold optimization
    // For now, we'll use the simple word overlap method
  }

  public async evaluate(
    command: string,
    context: TaskContext
  ): Promise<{
    similarity: number;
    similarCommands: Array<{
      command: string;
      similarity: number;
      context: TaskContext;
    }>;
  }> {
    const similarity = await this.getSimilarity(command, context);
    const similarCommands = await this.findSimilarCommands(command);

    return {
      similarity,
      similarCommands
    };
  }
} 