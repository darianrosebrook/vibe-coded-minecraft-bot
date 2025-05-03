# ML State Management Architecture

This directory contains the state management system for the Minecraft bot's machine learning components. The architecture is designed to provide a consistent, type-safe way to manage different aspects of the bot's state.

## Key Concepts

### State Types

The state system consists of several layers:

1. **Base State Types** (`/src/types/ml/state.ts`): Core interfaces that define the structure of all ML states
2. **Feature-Specific State Types** (e.g., `miningState.ts`, `explorationState.ts`): Specialized state interfaces for different bot activities
3. **Enhanced Game State** (`types.ts`): Extension of the GameState that includes ML-specific data

### Type Organization

- **Central Type Index** (`/src/types/ml/index.ts`): Re-exports all ML-related types to provide a centralized access point
- **Validation Types** (`/src/types/ml/validation.ts`): Types for state validation, prediction evaluation, and context weighting

## Usage Guidelines

### Accessing State

Use the central type index to access all state types:

```typescript
import { MiningMLState, ExplorationMLState } from '@/types/ml';
```

### Implementing Feature-Specific States

When creating a new feature-specific state:

1. Follow the naming convention `{Feature}MLState`
2. Export all supporting interfaces
3. Register the new types in the central type index

### State Consistency

To maintain consistency across state implementations:

1. Reuse core types from `/src/types/ml/state.ts` (e.g., `EntityInfo`, `BlockInfo`)
2. Follow established patterns for performance metrics and timestamps
3. Use the `@/types/ml` import path for all ML types

## State Managers

The `manager.ts` file provides the `MLStateManager` class that handles state transitions, validation, and persistence. It serves as the central hub for state operations.

## State-Based Models

The `models.ts` file contains model implementations that operate on the state data. These include:

- **BaseModel**: Abstract base class for all ML models
- **ResourceNeedModel/Predictor**: Predicts resource needs based on state
- **PlayerRequestModel/Predictor**: Predicts player requests based on state
- **TaskDurationModel/Predictor**: Predicts task durations based on state

## Extending the State System

When extending the state system:

1. Define new types in appropriate files
2. Update the central type index
3. Implement corresponding predictors or models
4. Add validation rules if needed

## Integration with Other Systems

The state system integrates with:

- **Context Manager** (`/src/llm/context/manager.ts`): For accessing the GameState
- **Training Data Collector** (`training_data_collector.ts`): For gathering training data
- **Data Preprocessor** (`data_preprocessor.ts`): For preparing data for model training 