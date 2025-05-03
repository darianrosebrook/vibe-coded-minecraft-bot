import axios from "axios";

export interface LLMClient {
  generate(prompt: string): Promise<string>;
  checkAvailability(): Promise<void>;
  listModels(): Promise<{
    models: { name: string; size: number; modified_at: string }[];
  }>;
  getModelInfo(
    modelName: string
  ): Promise<{ name: string; size: number; modified_at: string }>;
}

export class LLMError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "LLMError";
  }
}

export class OllamaClient implements LLMClient {
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    baseUrl: string = process.env.OLLAMA_HOST ?? "http://localhost:11434",
    model: string = process.env.OLLAMA_MODEL ?? "llama3.2:1b",
    temperature: number = parseFloat(process.env.OLLAMA_TEMPERATURE ?? "0.2"),
    maxTokens: number = parseInt(process.env.OLLAMA_MAX_TOKENS ?? "1000", 10),
    timeout: number = parseInt(process.env.OLLAMA_TIMEOUT ?? "60000", 10),
    maxRetries: number = parseInt(process.env.OLLAMA_MAX_RETRIES ?? "3", 10),
    retryDelay: number = parseInt(process.env.OLLAMA_RETRY_DELAY ?? "1000", 10)
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async checkConnection(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/api/version`, { timeout: 5000 });
    } catch (error) {
      throw new LLMError(
        "Failed to connect to Ollama service. Please ensure Ollama is running and accessible.",
        "OLLAMA_NOT_RUNNING"
      );
    }
  }

  async generate(prompt: string): Promise<string> {
    let lastError: Error | null = null;
    
    // First check if we can connect to Ollama
    try {
      await this.checkConnection();
    } catch (error) {
      throw error; // Propagate connection error immediately
    }
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/api/generate`,
          {
            model: this.model,
            prompt,
            stream: false,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            format: "json"
          },
          {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const result = response.data.response?.trim() ?? '';
        
        try {
          JSON.parse(result);
          return result;
        } catch (e) {
          lastError = new LLMError(
            `Invalid JSON response from LLM: ${e instanceof Error ? e.message : String(e)}`,
            'INVALID_JSON'
          );
          
          if (attempt < this.maxRetries) {
            await this.sleep(this.retryDelay);
            continue;
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay);
          continue;
        }
      }
    }

    throw lastError ?? new LLMError('Failed to generate response after all retries', 'MAX_RETRIES_EXCEEDED');
  }

  async checkAvailability(): Promise<void> {
    try {
      await this.checkConnection();
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
    } catch (error) {
      throw new LLMError(
        "Failed to connect to Ollama service. Please ensure Ollama is running and accessible.",
        "OLLAMA_NOT_RUNNING"
      );
    }
  }

  async listModels(): Promise<{
    models: { name: string; size: number; modified_at: string }[];
  }> {
    try {
      await this.checkConnection();
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      throw new LLMError(
        "Failed to list Ollama models. Please ensure Ollama is running and accessible.",
        "MODEL_LIST_ERROR"
      );
    }
  }

  async getModelInfo(
    modelName: string
  ): Promise<{ name: string; size: number; modified_at: string }> {
    try {
      await this.checkConnection();
      const response = await axios.get(`${this.baseUrl}/api/show`, {
        params: { name: modelName },
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      throw new LLMError(
        `Failed to get info for model ${modelName}. Please ensure Ollama is running and accessible.`,
        "MODEL_INFO_ERROR"
      );
    }
  }
}

// For backward compatibility
export const llm = new OllamaClient();
export const checkModelAvailability = () => llm.checkAvailability();
