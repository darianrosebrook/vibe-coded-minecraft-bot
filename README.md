# Minecraft Bot with LLM Integration

A Minecraft bot that uses local LLM (Ollama) to interpret natural language commands and execute complex tasks in-game.

## Project Status

### 🚨 Bugs and Critical Issues requiring immediate attention

#### Task Architecture & Dependencies

1. **Task Dependency System**

   - Implement task dependency graph for complex operations
   - Add pre-task validation for required items and conditions
   - Create task queue with dependency resolution
   - Add task conflict detection and resolution

2. **Resource Management**

   - Implement inventory state tracking
   - Add crafting table detection and management
   - Create resource requirement validation
   - Add automatic resource gathering for missing items

3. **Task Planning & Validation**

   - Add pre-execution checks for all tasks
   - Implement task feasibility validation
   - Create task planning phase with resource verification
   - Add automatic task decomposition for complex operations

4. **Task Queue Improvements**

   - Implement priority-based task queue
   - Add task dependency tracking
   - Create task conflict resolution system
   - Add task state persistence

5. **Crafting System**

   - Implement crafting recipe validation
   - Add crafting table requirement checking
   - Create material requirement verification
   - Add automatic material gathering for crafting

6. **Task Parsing & LLM Context**
   - Improve task parsing from LLM responses
     - Fix incorrect task type detection (e.g., mining vs crafting vs query)
     - Add proper validation of task parameters
     - Implement context-aware task resolution
   - Condense and optimize prompting system
     - Remove redundant context in prompts
     - Focus on essential world state information
     - Streamline task parameter extraction
   - Better context integration
     - Player interaction history
     - Bot's current state and inventory
     - Immediate surroundings and available resources
     - Recent task history and outcomes
   - Task Type Resolution
     - Implement strict type validation
     - Add fallback mechanisms for ambiguous commands
     - Create type-specific parameter validation
   - Context Management
     - Maintain conversation history
     - Track task execution context
     - Store relevant world state changes
   - Error Handling
     - Add specific error types for parsing failures
     - Implement recovery strategies for parsing errors
     - Create user-friendly error messages
   - Example Issues:

     ```
     Input: ".bot do you need a pickaxe?"
     Expected: query task with inventory check
     Actual: mining task returned

     Input: ".bot you should craft a pickaxe"
     Expected: crafting task
     Actual: query task returned
     ```

### ✅ Completed Features

#### Core Infrastructure

- Basic bot framework using Mineflayer
- Pathfinding with mineflayer-pathfinder
- Auto-collection of items
- Auto-eating for survival
- Basic LLM integration with Ollama
- JSON schema validation for tasks
- Base task class for standardized task execution
- Command prefix system (`.bot`)
- Basic progress persistence across bot restarts
- Environment configuration with `.env.example` template
  - Server configuration
  - Minecraft bot settings
  - Ollama LLM integration
  - Storage and logging options
  - Feature flags
- Production-ready containerization
  - Multi-stage Docker builds
  - Development and production configurations
  - Health checks and monitoring
  - Secure non-root user
  - Volume management for persistence
  - Network isolation
  - Automatic restarts
- Basic observability
  - Structured logging with Winston
  - Basic health check endpoints
  - Configuration management with dotenv
  - Type-safe configuration with Zod
  - Environment-specific settings
  - Validation at startup
  - Default values for all settings
  - Feature flags for easy toggling
- Basic world tracking
  - Real-time block position tracking
  - Resource discovery and mapping
  - Biome-based block tracking
  - Periodic resource scanning
  - Nearest resource finding
  - Chunk-based scanning

#### Task Modules

- Basic mining operations
  - Resource discovery and tracking
  - Smart tool selection
  - Pathfinding integration
  - Progress tracking
  - Error handling and retries
- Base task framework
  - Common task functionality
  - Retry mechanisms
  - Timeout handling
  - Progress tracking
  - Error handling
- Basic farming module
  - Multi-crop support (wheat, carrots, potatoes, beetroot)
  - Automatic harvesting and replanting
  - Configurable farming radius
  - Water source verification
  - Smart pathfinding for efficient movement
  - Progress tracking
  - Error handling with retries
  - Continuous operation with periodic checks
- Basic navigation module with coordinate-based movement
- Basic inventory management module
- Basic redstone & automation module
  - Basic redstone device interaction
  - Simple circuit monitoring
  - Basic farm management

#### Error Handling System

- Basic error categorization
  - Network errors
  - Pathfinding errors
  - Inventory errors
  - Block interaction errors
  - Entity interaction errors
  - LLM errors
- Simple retry strategies
  - Basic backoff
  - Category-specific retry limits
- Basic fallback behaviors
  - Server reconnection
  - Alternative pathfinding
  - Inventory management

#### Web Dashboard

- Basic web server setup with Express
- Socket.IO integration for real-time updates
- Static file serving
- Basic API routes
- Initial UI structure

### 🔄 In Progress

#### Core Infrastructure & DevOps

- Enhanced Configuration
  - Config versioning with semantic versioning
  - Environment-specific validation rules
  - Dynamic config reloading without restart
  - Config migration support
  - Validation error reporting
  - Default value inheritance
  - Type-safe configuration access

#### LLM & Command Pipeline

- Advanced LLM Integration
  - Multi-model support with automatic model switching
  - Prompt versioning with semantic versioning
  - Context management with world state tracking
  - Response validation with schema enforcement
  - Metrics collection for LLM performance
  - Error handling with retry strategies
- Enhanced Command Processing
  - Command history persistence
  - Undo/redo functionality
  - Command aliases
  - Complex command chaining

#### World Awareness & Mapping

- Advanced World Tracking
  - Chunk caching
  - Resource hotspot tracking
  - Biome analysis
  - 3D visualization
- Event System
  - Event bus implementation
  - Custom event handlers
  - Event persistence

#### Testing & Quality

- Test Infrastructure
  - Unit test framework
  - Integration test setup
  - Mock server implementation
  - Performance benchmarks
- Quality Assurance
  - Schema validation
  - Error injection testing
  - Load testing
  - Security testing

#### Web Dashboard & UX

- Enhanced Web Interface
  - Authentication system
  - Role-based access
  - Interactive task builder
  - Real-time monitoring
  - Mobile-responsive design
- User Experience
  - In-game notifications
  - Desktop alerts
  - Progress visualization
  - Task history browser

### ❌ Planned Features

#### Infrastructure & DevOps

- Advanced Containerization
  - Kubernetes manifests
  - Helm charts
  - Multi-stage builds
- CI/CD Pipeline
  - Automated testing
  - Docker image publishing
  - Version tagging
- Advanced Observability
  - Prometheus metrics
  - Grafana dashboards
  - Distributed tracing
  - Structured logging with rotation

#### Enhanced Task Modules

- Tool management
- Equipment optimization
- Task prioritization
- Multi-bot coordination

## Quick Wins

- Implement basic metrics endpoint
- Add Docker support
- Implement `gatherBlock` task
- Add basic authentication
- Set up ESLint and Prettier
- Add basic test framework

## Project Structure

The project is organized into several key directories, each serving a specific purpose:

### Core Directories

- `src/` - Main source code directory
  - `bot/` - Core bot functionality and initialization
  - `commands/` - Command handling and processing
  - `config/` - Configuration management and validation
  - `error/` - Error handling and custom error types
  - `inventory/` - Inventory management and tracking
  - `llm/` - Language model integration and prompt management
  - `ml/` - Machine learning related functionality
  - `schema/` - JSON schema definitions and validation
  - `storage/` - Data persistence and storage management
  - `tasks/` - Task definitions and execution logic
  - `tools/` - Utility functions and helper modules
  - `types/` - TypeScript type definitions
  - `utils/` - General utility functions
  - `web/` - Web dashboard and API endpoints

### Supporting Directories

- `docs/` - Project documentation and implementation plans
  - `implementation_plans/` - Detailed plans for feature implementation
- `docker/` - Docker-related configuration files
- `buildLogs/` - Build process logs
- `logs/` - Application runtime logs
- `dist/` - Compiled JavaScript output
- `data/` - Application data storage

### Configuration Files

- `package.json` - Node.js project configuration and dependencies
- `tsconfig.json` - TypeScript configuration
- `jest.config.js` - Jest testing configuration
- `Dockerfile` - Docker build configuration
- `docker-compose.yml` - Docker Compose configuration
- `docker-compose.dev.yml` - Development environment Docker Compose configuration
- `docker-compose.prod.yml` - Production environment Docker Compose configuration

## Dependencies

The project uses the following key dependencies:

| Component        | Package                   | Purpose                              |
| ---------------- | ------------------------- | ------------------------------------ |
| Bot framework    | mineflayer                | Connect & control Minecraft bot      |
| Navigation       | mineflayer-pathfinder     | World pathfinding & movement         |
| Block collection | mineflayer-collectblock   | Auto-collect dropped items           |
| Auto-eat         | mineflayer-auto-eat       | Keep bot fed                         |
| PvP              | mineflayer-pvp            | Player vs player combat              |
| Tool management  | mineflayer-tool           | Smart tool selection                 |
| HTTP client      | axios                     | Query Ollama's local LLM API         |
| JSON validation  | ajv                       | Ensure LLM outputs match task schema |
| Web server       | express                   | HTTP server for dashboard            |
| Real-time comms  | socket.io                 | Live updates for dashboard           |
| Logging          | winston                   | Structured logging                   |
| Log rotation     | winston-daily-rotate-file | Log file management                  |
| HTTP logging     | morgan                    | Request logging                      |
| Metrics          | prom-client               | Prometheus metrics                   |
| Validation       | zod                       | Runtime type checking                |
| Testing          | jest                      | Test framework                       |
| Type checking    | typescript                | Static type checking                 |
| Development      | nodemon                   | Development server                   |
| Containerization | docker                    | Container runtime                    |
| Orchestration    | docker-compose            | Multi-container apps                 |

## Starting Tasks

The bot accepts natural language commands through the Minecraft chat. All commands must be prefixed with `.bot` to be recognized.

### Basic Command Format

```
.bot <natural language command>
```

### Examples

#### Resource Collection

```
.bot gather 64 cobblestone
.bot mine 32 iron ore
.bot fish for 10 minutes
```

#### Processing & Crafting

```
.bot craft 32 sticks
.bot smelt 16 iron ore
.bot brew 3 strength potions
```

#### Farming

```
.bot tend the wheat farm
.bot plant carrots in a 5x5 area
.bot harvest the potato farm
```

#### Construction

```
.bot build a 10x5x10 platform of stone
.bot flatten the area from 100,64,-200 to 200,64,-100
```

#### Redstone & Automation

```
.bot toggle the lever at 100 64 -200
.bot monitor the redstone circuit in my farm
.bot manage my automated wheat farm
```

### Task Status

You can check the status of your tasks using these commands:

```
.bot status - Shows current task progress
.bot list - Lists all active tasks
.bot cancel - Cancels the current task
```

### Task Parameters

The bot will automatically determine the best parameters for your task based on the context. However, you can specify additional parameters in your command:

```
.bot gather 64 cobblestone near my base
.bot mine iron ore with fortune pickaxe
.bot farm wheat with water source
```

### Error Handling

If a task encounters an error, the bot will:

1. Attempt to recover automatically
2. Notify you in chat about the issue
3. Suggest possible solutions
4. Allow you to retry or cancel the task

### Task Persistence

Tasks are automatically saved and can be resumed if:

- The bot disconnects
- The server restarts
- The bot is restarted

To resume a task after a restart, simply use the same command again.

## Error Handling System

The bot features a sophisticated error handling system that automatically categorizes and responds to different types of errors:

### Error Categories

- **Network Errors**: Connection issues, server disconnects
- **Pathfinding Errors**: Navigation failures, blocked paths
- **Inventory Errors**: Full inventory, item management issues
- **Block Interaction Errors**: Mining, placing, or breaking block failures
- **Entity Interaction Errors**: Mob or player interaction issues
- **LLM Errors**: Language model integration problems
- **Redstone Errors**: Circuit failures, device interaction issues

### Retry Strategies

Each error category has its own retry strategy:

```typescript
{
  maxRetries: number; // Maximum number of retry attempts
  baseDelay: number; // Initial delay between retries (ms)
  maxDelay: number; // Maximum delay between retries (ms)
  backoffFactor: number; // Exponential backoff multiplier
  shouldRetry: (context) => boolean; // Custom retry condition
}
```

### Fallback Behaviors

When retries fail, the system attempts fallback strategies:

- **Network Errors**: Automatic server reconnection
- **Pathfinding Errors**: Alternative pathfinding strategies
- **Inventory Errors**: Store items in chests or drop non-essentials
- **Block Interaction Errors**: Try different interaction methods
- **Entity Interaction Errors**: Alternative interaction approaches
- **LLM Errors**: Fallback to simpler command parsing
- **Redstone Errors**: Circuit isolation, manual override options

### Error Context

Each error is handled with rich context:

```typescript
{
  category: ErrorCategory;
  severity: ErrorSeverity;
  taskId: string;
  taskType: string;
  location?: { x: number; y: number; z: number };
  timestamp: number;
  retryCount: number;
  error: Error;
  metadata?: Record<string, any>;
}
```

## Task Schema

Tasks are defined in JSON format with the following structure:

```json
{
  "type": "mining" | "farming" | "navigation" | "inventory" | "redstone" | "crafting" | "gathering" | "processing" | "construction" | "exploration" | "storage" | "combat",
  "parameters": {
    // Task-specific parameters
  },
  "priority": {
    "type": "integer",
    "minimum": 0,
    "maximum": 100,
    "default": 50
  },
  "timeout": {
    "type": "integer",
    "minimum": 1000,
    "default": 30000
  },
  "retry": {
    "maxAttempts": { "type": "integer", "minimum": 0, "default": 3 },
    "backoff": { "type": "number", "minimum": 1, "default": 2 },
    "maxDelay": { "type": "integer", "minimum": 1000, "default": 30000 }
  },
  "requirements": {
    "items": [
      {
        "type": "string",
        "quantity": "integer",
        "required": "boolean"
      }
    ],
    "tools": [
      {
        "type": "string",
        "material": "string",
        "required": "boolean"
      }
    ],
    "blocks": [
      {
        "type": "string",
        "quantity": "integer",
        "required": "boolean"
      }
    ],
    "entities": [
      {
        "type": "string",
        "quantity": "integer",
        "required": "boolean"
      }
    ]
  },
  "validation": {
    "preChecks": [
      {
        "type": "string",
        "condition": "string",
        "error": "string"
      }
    ],
    "postChecks": [
      {
        "type": "string",
        "condition": "string",
        "error": "string"
      }
    ]
  },
  "dependencies": [
    {
      "type": "string",
      "parameters": "object",
      "required": "boolean"
    }
  ]
}
```

### Task Types

The bot supports the following task types:

- **Mining**: Resource extraction tasks
- **Farming**: Crop and animal management
- **Navigation**: Movement and pathfinding
- **Inventory**: Item management
- **Redstone**: Circuit and automation
- **Crafting**: Item creation
- **Gathering**: Resource collection
- **Processing**: Item transformation
- **Construction**: Building and structure creation
- **Exploration**: World discovery
- **Storage**: Container management
- **Combat**: Entity interaction

### Resource Requirements

Tasks can specify requirements for:

- **Items**: Required items and quantities
- **Tools**: Required tools and materials
- **Blocks**: Required blocks and quantities
- **Entities**: Required entities and quantities

### Task Dependencies

Tasks can depend on other tasks:

- **Type**: The type of task required
- **Parameters**: Specific parameters for the dependency
- **Required**: Whether the dependency is mandatory

### Validation Rules

Tasks can include validation checks:

- **Pre-checks**: Conditions to verify before execution
- **Post-checks**: Conditions to verify after execution
- **Error messages**: Custom error messages for failed checks

### Task Configuration

Tasks can be configured with:

- **Priority**: Task importance (0-100)
- **Timeout**: Maximum execution time
- **Retry settings**: Retry attempts and backoff strategy

### Example Tasks

#### Mining with Requirements

```json
{
  "type": "mining",
  "parameters": {
    "block": "diamond_ore",
    "quantity": 5
  },
  "requirements": {
    "tools": [
      {
        "type": "pickaxe",
        "material": "diamond",
        "required": true
      }
    ]
  },
  "validation": {
    "preChecks": [
      {
        "type": "inventory",
        "condition": "hasEmptySlots()",
        "error": "Inventory is full"
      }
    ]
  }
}
```

#### Crafting with Dependencies

```json
{
  "type": "crafting",
  "parameters": {
    "itemType": "diamond_pickaxe",
    "quantity": 1
  },
  "dependencies": [
    {
      "type": "gathering",
      "parameters": {
        "itemType": "diamond",
        "quantity": 3
      },
      "required": true
    },
    {
      "type": "crafting",
      "parameters": {
        "itemType": "stick",
        "quantity": 2
      },
      "required": true
    }
  ]
}
```

## Progress Tracking & Persistence

The bot features a sophisticated progress tracking and persistence system:

### Progress Tracking

- Real-time progress updates
- Location tracking during tasks
- Estimated time remaining calculations
- Progress history with timestamps
- Error and retry tracking
- Task-specific metrics (e.g., blocks mined per second)

### Progress Persistence

- Automatic saving of progress to disk
- Resume tasks after bot restarts
- Configurable retention policies:
  - `maxAge`: Maximum age of progress files (default: 7 days)
  - `maxCompletedAge`: Maximum age of completed task results (default: 30 days)
  - `cleanupInterval`: How often to run cleanup (default: 24 hours)
  - `maxProgressHistory`: Maximum number of progress history entries (default: 1000)

### Storage Configuration

```typescript
const storage = new TaskStorage("./data", {
  maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
  maxCompletedAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  cleanupInterval: 12 * 60 * 60 * 1000, // 12 hours
  maxProgressHistory: 500,
});
```

### Cleanup Rules

- Completed tasks: Kept for `maxCompletedAge`
- Failed tasks: Kept for `maxAge`
- In-progress tasks: Kept until completed or failed
- Progress history: Trimmed to `maxProgressHistory` entries

## Bot Capabilities

### 💎 Resource Collection

#### gatherBlock

Collects specified blocks from the environment.

Example:

```
User: "gather 64 cobblestone"
LLM Output: {
  "type": "gathering",
  "parameters": {
    "blockType": "cobblestone",
    "quantity": 64
  }
}
```

#### smeltItem

Smelts items in a furnace.

Example:

```
User: "smelt 32 iron ore"
LLM Output: {
  "type": "processing",
  "parameters": {
    "itemType": "iron_ore",
    "quantity": 32
  }
}
```

#### fish

Fishes for items using a fishing rod.

Example:

```
User: "fish for 10 minutes"
LLM Output: {
  "type": "gathering",
  "parameters": {
    "durationSeconds": 600
  }
}
```

### ⚒️ Processing & Crafting

#### craftItem

Crafts items using available recipes.

Example:

```
User: "craft 32 sticks"
LLM Output: {
  "type": "processing",
  "parameters": {
    "itemType": "stick",
    "quantity": 32
  }
}
```

#### brewPotion

Brews potions in a brewing stand.

Example:

```
User: "brew 3 strength potions"
LLM Output: {
  "type": "processing",
  "parameters": {
    "potionType": "strength",
    "quantity": 3
  }
}
```

### 🌱 Farming & Animal Care

#### tendFarm

Manages farm operations with advanced features.

Example:

```
User: "tend the wheat farm"
LLM Output: {
  "type": "farming",
  "parameters": {
    "cropType": "wheat",
    "radius": 32,
    "checkInterval": 5000,
    "requiresWater": true,
    "minWaterBlocks": 4
  }
}
```

Features:

- Automatic detection of mature crops
- Smart harvesting and replanting
- Configurable farming radius
- Water source verification
- Continuous operation with periodic checks
- Progress tracking and metrics
- Error handling with automatic retries

#### breedAnimals

Breeds animals of specified type.

Example:

```
User: "breed 2 pairs of cows"
LLM Output: {
  "type": "farming",
  "parameters": {
    "animalType": "cow",
    "quantity": 2
  }
}
```
