import { MLErrorHandlerImpl } from "../../ml/command/error_handler";
import { LLMClient } from "../../utils/llmClient";
import { TaskContext } from "@/types";

export interface ParsingError {
  type: "type_mismatch" | "parameter_invalid" | "context_missing" | "ambiguous";
  message: string;
  context: TaskContext;
  recoveryStrategy?: string;
  pluginError?: {
    plugin: string;
    error: string;
    recoveryStrategy?: string;
  };
}

export interface ErrorRecoveryStrategy {
  name: string;
  description: string;
  steps: string[];
  confidence: number;
  fallback?: string;
}

export class ParsingErrorHandler {
  private mlErrorHandler: MLErrorHandlerImpl;
  private errorHistory: Map<string, number> = new Map();
  private recoveryStrategies: Map<string, ErrorRecoveryStrategy> = new Map();

  constructor(llmClient: LLMClient) {
    this.mlErrorHandler = new MLErrorHandlerImpl(llmClient);
    this.initializeRecoveryStrategies();
  }

  private initializeRecoveryStrategies() {
    // Load predefined recovery strategies
    this.recoveryStrategies.set("type_mismatch", {
      name: "Type Mismatch Recovery",
      description:
        "Attempt to resolve type mismatches by converting or validating types",
      steps: [
        "Identify the expected type",
        "Check if conversion is possible",
        "Validate the converted value",
        "Update the context if successful",
      ],
      confidence: 0.8,
    });

    this.recoveryStrategies.set("parameter_invalid", {
      name: "Parameter Validation Recovery",
      description:
        "Attempt to fix invalid parameters by suggesting alternatives",
      steps: [
        "Identify invalid parameters",
        "Find similar valid parameters",
        "Suggest corrections",
        "Apply the most likely correction",
      ],
      confidence: 0.7,
    });

    this.recoveryStrategies.set("context_missing", {
      name: "Context Recovery",
      description:
        "Attempt to recover missing context by gathering required information",
      steps: [
        "Identify missing context elements",
        "Gather required information",
        "Update context with gathered data",
        "Retry the operation",
      ],
      confidence: 0.9,
    });

    this.recoveryStrategies.set("ambiguous", {
      name: "Ambiguity Resolution",
      description:
        "Attempt to resolve ambiguous commands by requesting clarification",
      steps: [
        "Identify ambiguous elements",
        "Generate clarification questions",
        "Request user input",
        "Process the clarification",
      ],
      confidence: 0.6,
    });
  }

  async handleError(error: ParsingError): Promise<ErrorRecoveryStrategy> {
    // Track error frequency
    this.trackError(error.type);

    // Get ML-based error predictions
    const mlPredictions = await this.mlErrorHandler.predictErrors(
      error.message,
      error.context
    );

    // Select the most appropriate recovery strategy
    const strategy = await this.selectRecoveryStrategy(error, mlPredictions);

    // If the error is plugin-related, handle it separately
    if (error.pluginError) {
      return this.handlePluginError(error.pluginError, strategy);
    }

    return strategy;
  }

  private async selectRecoveryStrategy(
    error: ParsingError,
    mlPredictions: any[]
  ): Promise<ErrorRecoveryStrategy> {
    // First try to get a predefined strategy
    const predefinedStrategy = this.recoveryStrategies.get(error.type);
    if (predefinedStrategy && predefinedStrategy.confidence > 0.7) {
      return predefinedStrategy;
    }

    // If no predefined strategy is suitable, use ML to generate one
    const mlStrategy = await this.mlErrorHandler.selectRecoveryStrategy(
      new Error(error.message)
    );

    return {
      name: "ML-Generated Recovery",
      description: mlStrategy,
      steps: await this.mlErrorHandler.suggestCorrections(
        new Error(error.message)
      ),
      confidence: 0.8,
    };
  }

  private async handlePluginError(
    pluginError: ParsingError["pluginError"],
    baseStrategy: ErrorRecoveryStrategy
  ): Promise<ErrorRecoveryStrategy> {
    if (!pluginError) return baseStrategy;

    // Get plugin-specific recovery suggestions
    const suggestions = await this.mlErrorHandler.suggestCorrections(
      new Error(pluginError.error)
    );

    return {
      ...baseStrategy,
      steps: [...baseStrategy.steps, ...suggestions],
      confidence: Math.min(baseStrategy.confidence, 0.8),
    };
  }

  private trackError(errorType: string) {
    const count = this.errorHistory.get(errorType) || 0;
    this.errorHistory.set(errorType, count + 1);
  }

  getErrorStatistics(): Map<string, number> {
    return new Map(this.errorHistory);
  }

  getRecoveryStrategy(name: string): ErrorRecoveryStrategy | undefined {
    return this.recoveryStrategies.get(name);
  }
}
