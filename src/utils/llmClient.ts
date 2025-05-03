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

  constructor(
    baseUrl: string = process.env.OLLAMA_HOST ?? "http://localhost:11434",
    model: string = process.env.OLLAMA_MODEL ?? "llama3.2:1b",
    temperature: number = parseFloat(process.env.OLLAMA_TEMPERATURE ?? "0.7"),
    maxTokens: number = parseInt(process.env.OLLAMA_MAX_TOKENS ?? "1000", 10),
    timeout: number = parseInt(process.env.OLLAMA_TIMEOUT ?? "60000", 10)
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.timeout = timeout;
  }

  async generate(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          temperature: this.temperature,
          num_predict: this.maxTokens,
        },
        {
          timeout: this.timeout,
        }
      );

      if (!response.data.response) {
        throw new LLMError("Empty response from Ollama", "EMPTY_RESPONSE");
      }

      return response.data.response.trim();
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
        throw new LLMError("Request to Ollama timed out", "REQUEST_TIMEOUT");
      }
      throw new LLMError(
        "Failed to generate response from Ollama",
        "REQUEST_FAILED"
      );
    }
  }

  async checkAvailability(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
    } catch (error) {
      throw new LLMError(
        "Failed to connect to Ollama service",
        "OLLAMA_NOT_RUNNING"
      );
    }
  }

  async listModels(): Promise<{
    models: { name: string; size: number; modified_at: string }[];
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      throw new LLMError("Failed to list Ollama models", "MODEL_LIST_ERROR");
    }
  }

  async getModelInfo(
    modelName: string
  ): Promise<{ name: string; size: number; modified_at: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/show`, {
        params: { name: modelName },
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      throw new LLMError(
        `Failed to get info for model ${modelName}`,
        "MODEL_INFO_ERROR"
      );
    }
  }
}

// For backward compatibility
export const llm = new OllamaClient();
export const checkModelAvailability = () => llm.checkAvailability();
