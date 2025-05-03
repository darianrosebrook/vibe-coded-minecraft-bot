# Language Model Integration

This directory handles the integration with the local LLM (Ollama) for natural language command processing and task generation.

## Components

### `llmClient.ts`
- LLM API client implementation
- Request/response handling
- Error management
- Retry logic

### `promptManager.ts`
- Prompt template management
- Context injection
- Prompt versioning
- Template validation

### `responseParser.ts`
- LLM response parsing
- JSON schema validation
- Error handling
- Fallback mechanisms

### `contextManager.ts`
- Conversation history
- World state tracking
- Bot state management
- Context optimization

## Features

- Natural language command processing
- Context-aware responses
- Multi-model support
- Response validation
- Error recovery
- Metrics collection

## Usage

```typescript
import { LLMClient } from './llmClient';
import { PromptManager } from './promptManager';

const llm = new LLMClient({
  model: 'llama2',
  baseUrl: 'http://localhost:11434'
});

const prompt = PromptManager.getPrompt('mining', {
  context: {
    inventory: bot.inventory,
    position: bot.position,
    // ... other context
  }
});

const response = await llm.generate(prompt);
```

## Prompt Templates

Prompts are structured to include:
- Task context
- World state
- Bot capabilities
- Previous interactions
- Error history

## Response Schema

LLM responses are validated against JSON schemas:

```typescript
interface LLMResponse {
  type: string;
  parameters: Record<string, any>;
  confidence: number;
  alternatives?: Array<{
    type: string;
    parameters: Record<string, any>;
  }>;
}
```

## Dependencies

- `axios` - HTTP client
- `ajv` - JSON schema validation
- `winston` - Logging 