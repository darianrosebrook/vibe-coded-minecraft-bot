# Command Handling

This directory manages the command processing system for the Minecraft bot, including command parsing, execution, and history tracking.

## Components

### `commandHandler.ts`
- Command processing
- Command validation
- Execution management
- Response handling

### `commandParser.ts`
- Command parsing
- Parameter extraction
- Syntax validation
- Error detection

### `commandHistory.ts`
- Command history tracking
- History persistence
- Undo/redo functionality
- History cleanup

### `aliases.ts`
- Command alias management
- Alias expansion
- Alias validation
- Alias persistence

## Command Types

### Chat Commands
- Natural language processing
- Command prefix (`.bot`)
- Parameter extraction
- Context awareness

### System Commands
- Bot control
- Configuration
- Status queries
- Maintenance

### Task Commands
- Task creation
- Task management
- Progress queries
- Task cancellation

## Command Structure

```typescript
interface Command {
  type: string;
  parameters: Record<string, any>;
  timestamp: number;
  user: string;
  context: CommandContext;
}
```

## Usage

```typescript
import { CommandHandler } from './commandHandler';
import { CommandParser } from './commandParser';

const handler = new CommandHandler();
const parser = new CommandParser();

// Process command
const command = parser.parse('.bot mine 64 iron ore');
const response = await handler.execute(command);

// Handle response
console.log(response.message);
```

## Command History

Command history includes:
- Command text
- Execution time
- User information
- Execution result
- Error information

## Error Handling

Command errors are categorized as:
- Syntax errors
- Validation errors
- Execution errors
- Permission errors

## Dependencies

- `winston` - Logging
- `zod` - Command validation
- `immer` - State management 