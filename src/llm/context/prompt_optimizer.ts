import { TaskContext } from "@/types";
import { MetricsStorage } from "./metrics_storage";

/**
 * Interface for prompt template configuration
 */
export interface PromptTemplate {
  id: string;
  version: number;
  template: string;
  contextRequirements: string[];
  tokenEstimate: number;
  qualityMetrics: {
    clarity: number;
    specificity: number;
    completeness: number;
  };
}

/**
 * Interface for context selection results
 */
interface ContextSelection {
  context: Record<string, any>;
  relevance: number;
  compressionRatio: number;
  tokenCount: number;
}

/**
 * Interface for prompt performance metrics
 */
export interface PromptMetrics {
  promptId: string;
  tokenUsage: number;
  responseQuality: number;
  contextRelevance: number;
  generationTime: number;
  timestamp: number;
}

/**
 * Interface for prompt optimization configuration
 */
interface PromptOptimizerConfig {
  maxTokens: number;
  minRelevance: number;
  compressionThreshold: number;
  qualityThreshold: number;
  versioningEnabled: boolean;
  performanceTracking: boolean;
}

/**
 * Interface for template version tracking
 */
export interface TemplateVersion {
  version: number;
  template: PromptTemplate;
  timestamp: number;
  metrics: PromptMetrics[];
}

interface PerformanceSuggestion {
  type: "context" | "template" | "compression";
  description: string;
  impact: number;
  implementation: string;
}

/**
 * Class responsible for optimizing prompts for LLM interactions
 */
export class PromptOptimizer {
  private templates: Map<string, TemplateVersion[]>;
  private metrics: PromptMetrics[];
  private config: PromptOptimizerConfig;
  private storage: MetricsStorage;

  constructor(config: Partial<PromptOptimizerConfig> = {}) {
    this.templates = new Map();
    this.metrics = [];
    this.config = {
      maxTokens: 2000,
      minRelevance: 0.7,
      compressionThreshold: 0.8,
      qualityThreshold: 0.8,
      versioningEnabled: true,
      performanceTracking: true,
      ...config,
    };
    this.storage = new MetricsStorage();
    this.loadStoredMetrics();
  }

  /**
   * Loads stored metrics and templates
   */
  private async loadStoredMetrics(): Promise<void> {
    try {
      this.metrics = await this.storage.getAllMetrics();
      const templateIds = new Set(this.metrics.map((m) => m.promptId));

      for (const templateId of templateIds) {
        const versions = await this.storage.getTemplateVersions(templateId);
        if (versions.length > 0) {
          this.templates.set(templateId, versions);
        }
      }
    } catch (error) {
      console.error("Error loading stored metrics:", error);
    }
  }

  /**
   * Registers a new prompt template with versioning
   */
  async registerTemplate(template: PromptTemplate): Promise<void> {
    if (!this.templates.has(template.id)) {
      this.templates.set(template.id, []);
    }

    const versions = this.templates.get(template.id)!;
    const existingVersion = versions.find(
      (v) => v.version === template.version
    );

    if (existingVersion) {
      throw new Error(`Template version ${template.version} already exists`);
    }

    versions.push({
      version: template.version,
      template,
      timestamp: Date.now(),
      metrics: [],
    });

    // Sort versions by version number
    versions.sort((a, b) => b.version - a.version);

    // Store updated versions
    await this.storage.storeTemplateVersions(template.id, versions);
  }

  /**
   * Rolls back to a previous template version
   */
  async rollbackTemplate(
    templateId: string,
    targetVersion: number
  ): Promise<void> {
    const versions = this.templates.get(templateId);
    if (!versions) {
      throw new Error(`Template ${templateId} not found`);
    }

    const targetIndex = versions.findIndex((v) => v.version === targetVersion);
    if (targetIndex === -1) {
      throw new Error(
        `Version ${targetVersion} not found for template ${templateId}`
      );
    }

    // Remove all versions after the target version
    const rolledBackVersions = versions.slice(targetIndex);
    this.templates.set(templateId, rolledBackVersions);

    // Store updated versions
    await this.storage.storeTemplateVersions(templateId, rolledBackVersions);
  }

  /**
   * Generates an optimized prompt based on context and requirements
   */
  generatePrompt(templateId: string, context: TaskContext): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const startTime = Date.now();
    const selectedContext = this.selectRelevantContext(
      context,
      template[0].template.contextRequirements
    );
    const prompt = this.formatPrompt(
      template[0].template.template,
      selectedContext
    );

    if (this.config.performanceTracking) {
      this.recordMetrics({
        promptId: templateId,
        tokenUsage: this.estimateTokens(prompt),
        responseQuality: this.estimateQuality(prompt),
        contextRelevance: selectedContext.relevance,
        generationTime: Date.now() - startTime,
        timestamp: Date.now(),
      });
    }

    return prompt;
  }

  /**
   * Selects and compresses relevant context based on requirements
   */
  private selectRelevantContext(
    context: TaskContext,
    requirements: string[]
  ): ContextSelection {
    const selectedContext: Record<string, any> = {};
    let totalTokens = 0;
    let relevantTokens = 0;

    // Process each context requirement
    for (const requirement of requirements) {
      const contextValue = this.extractContextValue(context, requirement);
      if (contextValue) {
        const compressedValue = this.compressContextValue(contextValue);
        selectedContext[requirement] = compressedValue;
        relevantTokens += this.estimateTokens(JSON.stringify(compressedValue));
      }
      totalTokens += this.estimateTokens(JSON.stringify(contextValue));
    }

    const compressionRatio =
      totalTokens > 0 ? relevantTokens / totalTokens : 1.0;
    const relevance = this.calculateRelevance(selectedContext, requirements);

    return {
      context: selectedContext,
      relevance,
      compressionRatio,
      tokenCount: relevantTokens,
    };
  }

  /**
   * Extracts a specific value from the context based on a requirement path
   */
  private extractContextValue(context: TaskContext, path: string): any {
    const parts = path.split(".");
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === "object") {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Compresses a context value to reduce token usage while maintaining relevance
   */
  private compressContextValue(value: any): any {
    if (Array.isArray(value)) {
      // For arrays, keep only the most recent items
      const maxItems = 5;
      return value.slice(-maxItems);
    } else if (typeof value === "object" && value !== null) {
      // For objects, keep only essential fields
      const compressed: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        if (this.isEssentialField(key)) {
          compressed[key] = this.compressContextValue(val);
        }
      }
      return compressed;
    }
    return value;
  }

  /**
   * Determines if a field is essential and should be kept during compression
   */
  private isEssentialField(key: string): boolean {
    const essentialFields = [
      "id",
      "type",
      "name",
      "status",
      "timestamp",
      "position",
      "health",
      "inventory",
      "state",
    ];
    return essentialFields.includes(key);
  }

  /**
   * Calculates the relevance of selected context to requirements
   */
  private calculateRelevance(
    context: Record<string, any>,
    requirements: string[]
  ): number {
    if (requirements.length === 0) return 1.0;

    let fulfilledRequirements = 0;
    for (const requirement of requirements) {
      if (context[requirement] !== undefined && context[requirement] !== null) {
        fulfilledRequirements++;
      }
    }

    return fulfilledRequirements / requirements.length;
  }

  /**
   * Formats the prompt template with selected context
   */
  private formatPrompt(template: string, context: ContextSelection): string {
    let formattedPrompt = template;

    // Replace context placeholders
    for (const [key, value] of Object.entries(context.context)) {
      const placeholder = `{${key}}`;
      if (formattedPrompt.includes(placeholder)) {
        formattedPrompt = formattedPrompt.replace(
          placeholder,
          this.formatContextValue(value)
        );
      }
    }

    // Add context metadata if needed
    if (this.config.qualityThreshold > 0) {
      formattedPrompt += `\n\nContext Relevance: ${context.relevance.toFixed(
        2
      )}`;
      formattedPrompt += `\nContext Compression: ${context.compressionRatio.toFixed(
        2
      )}`;
    }

    return formattedPrompt;
  }

  /**
   * Formats a context value for insertion into the prompt
   */
  private formatContextValue(value: any): string {
    if (Array.isArray(value)) {
      return value.map((item) => this.formatContextValue(item)).join(", ");
    } else if (typeof value === "object" && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  /**
   * Estimates token count for a prompt using a simple approximation
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimates quality metrics for a prompt
   */
  private estimateQuality(prompt: string): number {
    // Simple quality estimation based on:
    // 1. Presence of required context
    // 2. Prompt length (not too short, not too long)
    // 3. Formatting quality

    const lengthScore = this.calculateLengthScore(prompt);
    const formattingScore = this.calculateFormattingScore(prompt);

    return (lengthScore + formattingScore) / 2;
  }

  /**
   * Calculates a score based on prompt length
   */
  private calculateLengthScore(prompt: string): number {
    const tokenCount = this.estimateTokens(prompt);
    const idealLength = this.config.maxTokens * 0.7; // 70% of max tokens

    if (tokenCount < idealLength * 0.3) return 0.3; // Too short
    if (tokenCount > this.config.maxTokens) return 0.3; // Too long

    // Score decreases as we get further from ideal length
    const distance = Math.abs(tokenCount - idealLength);
    return Math.max(0.3, 1 - distance / idealLength);
  }

  /**
   * Calculates a score based on prompt formatting
   */
  private calculateFormattingScore(prompt: string): number {
    let score = 1.0;

    // Check for proper line breaks
    const lineCount = prompt.split("\n").length;
    if (lineCount < 3) score *= 0.8;

    // Check for proper spacing
    const doubleSpaces = (prompt.match(/  /g) || []).length;
    if (doubleSpaces > 5) score *= 0.9;

    // Check for proper punctuation
    const sentences = prompt.split(/[.!?]/);
    const avgLength =
      sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    if (avgLength > 100) score *= 0.8;

    return score;
  }

  /**
   * Records performance metrics for a prompt
   */
  private async recordMetrics(metrics: PromptMetrics): Promise<void> {
    this.metrics.push(metrics);

    // Update template version metrics
    const versions = this.templates.get(metrics.promptId);
    if (versions && versions.length > 0) {
      versions[0].metrics.push(metrics);
      await this.storage.storeTemplateVersions(metrics.promptId, versions);
    }

    // Store metrics in persistent storage
    await this.storage.storeMetric(metrics);
  }

  /**
   * Gets performance suggestions for a template
   */
  async getPerformanceSuggestions(
    templateId: string
  ): Promise<PerformanceSuggestion[]> {
    const versions = this.templates.get(templateId);
    if (!versions || versions.length === 0) {
      return [];
    }

    const latestVersion = versions[0];
    const suggestions: PerformanceSuggestion[] = [];

    // Analyze context relevance
    const avgRelevance = this.calculateAverageMetric(
      latestVersion.metrics,
      "contextRelevance"
    );
    if (avgRelevance < this.config.minRelevance) {
      suggestions.push({
        type: "context",
        description:
          "Context relevance is below threshold. Consider adding more relevant context or improving context selection.",
        impact: this.config.minRelevance - avgRelevance,
        implementation:
          "Review and update context requirements in the template.",
      });
    }

    // Analyze token usage
    const avgTokens = this.calculateAverageMetric(
      latestVersion.metrics,
      "tokenUsage"
    );
    if (avgTokens > this.config.maxTokens * 0.8) {
      suggestions.push({
        type: "compression",
        description:
          "Token usage is approaching limit. Consider implementing more aggressive context compression.",
        impact:
          (avgTokens - this.config.maxTokens * 0.8) / this.config.maxTokens,
        implementation:
          "Adjust compression threshold or implement more sophisticated compression algorithms.",
      });
    }

    // Analyze response quality
    const avgQuality = this.calculateAverageMetric(
      latestVersion.metrics,
      "responseQuality"
    );
    if (avgQuality < this.config.qualityThreshold) {
      suggestions.push({
        type: "template",
        description:
          "Response quality is below threshold. Consider improving prompt template structure.",
        impact: this.config.qualityThreshold - avgQuality,
        implementation:
          "Review and update prompt template structure and formatting.",
      });
    }

    return suggestions;
  }

  /**
   * Calculates average of a specific metric
   */
  private calculateAverageMetric(
    metrics: PromptMetrics[],
    metric: keyof PromptMetrics
  ): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + (m[metric] as number), 0);
    return sum / metrics.length;
  }

  /**
   * Gets all versions of a template
   */
  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return this.templates.get(templateId) || [];
  }

  /**
   * Cleans up old metrics
   */
  async cleanupMetrics(
    maxAge: number = 30 * 24 * 60 * 60 * 1000
  ): Promise<void> {
    await this.storage.cleanupMetrics(maxAge);
    await this.loadStoredMetrics(); // Reload after cleanup
  }
}
