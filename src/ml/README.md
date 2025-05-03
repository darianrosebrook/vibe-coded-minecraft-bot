# Machine Learning Components

This directory contains machine learning components for the Minecraft bot, organized into specialized modules for different aspects of the bot's learning capabilities.

## Directory Structure

### `hotspot/`
- Resource hotspot detection and analysis
- Pattern recognition for resource clusters
- Density-based analysis
- Predictive modeling for resource locations

### `command/`
- Command execution and management
- Command pattern recognition
- Command sequence optimization
- Command success prediction

### `task/`
- Task planning and execution
- Task prioritization
- Task completion prediction
- Task optimization

### `reinforcement/`
- Reinforcement learning algorithms
- Policy optimization
- Reward calculation and shaping
- State-action value estimation

### `state/`
- State representation and management
- State transition modeling
- State feature extraction
- State space optimization

### `performance/`
- Performance monitoring and analysis
- Performance optimization
- Resource usage tracking
- Efficiency metrics

## Core Features

### Hotspot Detection
- Resource clustering and analysis
- Pattern recognition in resource distribution
- Density-based hotspot identification
- Predictive modeling for resource discovery

### Reinforcement Learning
- Policy optimization for bot actions
- Reward calculation and shaping
- State management and representation
- Action selection and optimization

### Task Management
- Task planning and execution
- Task prioritization based on goals
- Task completion prediction
- Task sequence optimization

### State Management
- World state representation
- State transition modeling
- Feature extraction from game state
- State space optimization

### Performance Optimization
- Resource usage monitoring
- Efficiency metrics tracking
- Performance bottleneck identification
- Optimization strategies

## Data Structures

### Hotspot Data
```typescript
interface Hotspot {
  type: string;
  center: Vec3;
  radius: number;
  density: number;
  confidence: number;
  resources: Resource[];
}
```

### State Data
```typescript
interface State {
  position: Vec3;
  inventory: Item[];
  health: number;
  hunger: number;
  nearbyEntities: Entity[];
  worldState: WorldState;
}
```

## Usage Examples

```typescript
import { HotspotDetector } from './hotspot';
import { TaskPlanner } from './task';
import { StateManager } from './state';
import { PerformanceMonitor } from './performance';

// Initialize components
const detector = new HotspotDetector();
const planner = new TaskPlanner();
const stateManager = new StateManager();
const monitor = new PerformanceMonitor();

// Detect resource hotspots
const hotspots = await detector.detectHotspots(worldState);

// Plan and execute tasks
const task = await planner.createTask({
  type: 'mining',
  priority: 1,
  requirements: ['pickaxe', 'torch']
});

// Monitor performance
const metrics = await monitor.getMetrics();
```

## Models and Algorithms

### Hotspot Detection
- K-means clustering
- DBSCAN for density-based clustering
- Pattern recognition algorithms
- Predictive modeling

### Reinforcement Learning
- Q-learning
- Policy gradient methods
- Actor-critic architectures
- Deep Q-networks

### Task Planning
- Hierarchical task networks
- Planning algorithms
- Priority-based scheduling
- Resource allocation

## Development Process

1. Data Collection
   - World state observation
   - Action recording
   - Performance metrics
   - Resource distribution

2. Feature Engineering
   - Position features
   - Resource features
   - State features
   - Performance features

3. Model Development
   - Algorithm selection
   - Model architecture design
   - Training pipeline setup
   - Validation framework

4. Evaluation and Optimization
   - Performance metrics
   - Model validation
   - Hyperparameter tuning
   - System optimization

## Dependencies

- `tensorflow.js` - Machine learning framework
- `ml-matrix` - Matrix operations
- `winston` - Logging system
- `mineflayer` - Minecraft bot framework

## State Management

### Game State Factory Pattern

The Minecraft bot implementation now uses a factory pattern for managing game state objects. This approach provides several benefits:

1. **Consistency**: All state objects are created with consistent structure and default values
2. **Maintainability**: Changes to the state structure only need to be made in one place
3. **Extensibility**: The factory pattern allows easy extension for specialized state objects

### Implementation

The state factory system consists of two main components:

1. **`GameStateFactory`**: Base factory for creating standard game state objects (in `src/types/ml/gameState.ts`)
2. **`MLStateFactory`**: Extended factory with ML-specific state creation methods (in `src/ml/state/factory.ts`)

### Usage Examples

#### Creating Default State Objects

```typescript
// Get a default game state
const defaultState = GameStateFactory.createDefaultGameState();

// Get a command context with all defaults
const defaultContext = GameStateFactory.createCommandContext();

// Create ML-specific objects
const mlInventory = MLStateFactory.createDefaultMLInventory();
const resourceMap = MLStateFactory.createResourceMap(['iron_ore', 'coal_ore']);
const biomeBlocksMap = MLStateFactory.createBiomeBlocksMap(['plains', 'forest']);
```

#### Creating ML Input Vectors

```typescript
// Create a flat input vector for ML models
const mlInput = MLStateFactory.createMLModelInput(botState, worldState);
```

#### Using in Components

The state factories can be used in various components:

```typescript
// In a component constructor
constructor() {
  this.knownBlocks = MLStateFactory.createBiomeBlocksMap();
  this.resourceLocations = MLStateFactory.createResourceMap(['diamond_ore', 'iron_ore']);
}

// When handling ML processing
async processCommand(command) {
  // Use default context if none provided
  const context = commandContext || GameStateFactory.createCommandContext();
  
  // Process with context...
}
```

This pattern is particularly useful for ensuring consistent state objects throughout the codebase. 