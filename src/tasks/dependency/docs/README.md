# Task Dependency System

The Task Dependency System provides a robust framework for managing task dependencies, validation, and execution in the Minecraft bot. It consists of several key components that work together to ensure tasks are executed in the correct order and with proper validation.

## Components

### TaskNode

The `TaskNode` class represents a single task in the dependency graph. It manages:

- Task metadata and state
- Dependencies and dependents
- Validation status
- Execution state

Key methods:
- `addDependency(nodeId: string)`: Adds a dependency to this task
- `removeDependency(nodeId: string)`: Removes a dependency
- `addDependent(nodeId: string)`: Adds a dependent to this task
- `removeDependent(nodeId: string)`: Removes a dependent
- `setValidationStatus(status: ValidationStatus)`: Sets the validation status
- `setExecutionState(state: ExecutionState)`: Sets the execution state
- `setMetadata(key: string, value: any)`: Sets metadata for the task
- `getMetadata(key: string)`: Gets metadata for the task
- `isReady()`: Checks if the task is ready to execute
- `isCompleted()`: Checks if the task is completed
- `isFailed()`: Checks if the task has failed
- `isCancelled()`: Checks if the task has been cancelled
- `isRunning()`: Checks if the task is currently running
- `hasDependencies()`: Checks if the task has dependencies
- `hasDependents()`: Checks if the task has dependents

### DependencyGraph

The `DependencyGraph` class manages the overall task dependency structure. It provides:

- Node and edge management
- Cycle detection
- Topological sorting
- Ready node identification

Key methods:
- `addNode(task: Task, id?: string)`: Adds a new task node
- `removeNode(nodeId: string)`: Removes a task node
- `addEdge(fromId: string, toId: string)`: Adds a dependency edge
- `removeEdge(fromId: string, toId: string)`: Removes a dependency edge
- `hasCycle()`: Checks for cycles in the graph
- `getTopologicalOrder()`: Gets a valid execution order
- `getReadyNodes()`: Gets nodes ready for execution
- `getNode(nodeId: string)`: Gets a node by ID
- `getDependencies(nodeId: string)`: Gets all dependencies for a node
- `getDependents(nodeId: string)`: Gets all dependents for a node
- `clear()`: Clears the graph

### TaskQueue

The `TaskQueue` interface provides a structure for managing task execution:

- `queue`: Priority queue for task nodes
- `runningTasks`: Set of currently running task IDs
- `completedTasks`: Set of completed task IDs
- `failedTasks`: Set of failed task IDs

## Usage

### Basic Task Chain

```typescript
// Create tasks
const miningTask = {
  id: 'mining-1',
  type: 'mining',
  parameters: { block: 'iron_ore', quantity: 32 },
  priority: 1
};

const smeltingTask = {
  id: 'smelting-1',
  type: 'smelting',
  parameters: { item: 'iron_ore', quantity: 32 },
  priority: 2
};

// Create graph and add tasks
const graph = new DependencyGraph();
const miningNode = graph.addNode(miningTask);
const smeltingNode = graph.addNode(smeltingTask);

// Add dependency
graph.addEdge(miningNode.id, smeltingNode.id);

// Validate and execute tasks
miningNode.setValidationStatus(ValidationStatus.VALID);
miningNode.setExecutionState(ExecutionState.PENDING);

// Get ready nodes (should only be mining task)
const readyNodes = graph.getReadyNodes();
```

### Task Validation

Tasks can have different validation statuses:
- `PENDING`: Task validation is pending
- `VALID`: Task is valid and can be executed
- `INVALID`: Task is invalid and cannot be executed
- `SKIPPED`: Task is skipped (treated as completed)

### Execution States

Tasks can be in different execution states:
- `PENDING`: Task is waiting to be executed
- `READY`: Task is ready to be executed
- `RUNNING`: Task is currently executing
- `COMPLETED`: Task has completed successfully
- `FAILED`: Task has failed
- `CANCELLED`: Task has been cancelled

## Testing

The system includes comprehensive unit and integration tests:

- `node.test.ts`: Tests for TaskNode functionality
- `graph.test.ts`: Tests for DependencyGraph operations
- `integration.test.ts`: Tests for complete task chains and edge cases

## Error Handling

The system handles various error cases:
- Cycle detection in dependencies
- Invalid task states
- Missing dependencies
- Task failures and retries
- Task cancellation

## Next Steps

1. Implement TaskValidator class for pre-execution validation
2. Add validation rules system
3. Complete TaskQueue implementation for managing task execution
4. Add conflict detection and resolution
5. Implement metrics and monitoring 