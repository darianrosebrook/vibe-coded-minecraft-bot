export interface CommandExecutionResult {
    commandId: string;
    command: string;
    context: CommandContext;
    startTime: number;
    endTime: number;
    success: boolean;
    resources: ResourceUsage;
    metrics: CommandMetrics;
    errors?: CommandError[];
}

export interface CommandContext {
    player: string;
    location: Vec3;
    time: number;
    worldState: WorldState;
}

export interface WorldState {
    biome: string;
    timeOfDay: number;
    weather: string;
    nearbyEntities: EntityInfo[];
    nearbyBlocks: BlockInfo[];
}

export interface EntityInfo {
    type: string;
    position: Vec3;
    health?: number;
}

export interface BlockInfo {
    type: string;
    position: Vec3;
}

export interface ResourceUsage {
    cpu: {
        average: number;
        peak: number;
        duration: number;
    };
    memory: {
        average: number;
        peak: number;
        leaks: number;
    };
    network: {
        bytesSent: number;
        bytesReceived: number;
        latency: number;
    };
}

export interface CommandMetrics {
    accuracy: number;
    efficiency: number;
    satisfaction: number;
}

export interface CommandError {
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: number;
}

export interface SuccessMetrics {
    successRate: number;
    averageExecutionTime: number;
    resourceEfficiency: number;
    patterns: SuccessPattern[];
}

export interface SuccessPattern {
    commandType: string;
    context: CommandContext;
    executionTime: number;
    resourceUsage: ResourceUsage;
    successFactors: string[];
}

export interface FailureAnalysis {
    rootCause: string;
    contributingFactors: string[];
    recoveryAttempts: RecoveryAttempt[];
    recommendations: string[];
}

export interface RecoveryAttempt {
    strategy: string;
    success: boolean;
    executionTime: number;
    resourcesUsed: ResourceUsage;
}

export interface ModelUpdates {
    modelId: string;
    updates: {
        weights: number[];
        biases: number[];
        architecture: ModelArchitecture;
    };
    validationMetrics: ValidationMetrics;
}

export interface ModelArchitecture {
    layers: Layer[];
    optimizer: string;
    lossFunction: string;
}

export interface Layer {
    type: string;
    units: number;
    activation: string;
}

export interface ValidationMetrics {
    accuracy: number;
    loss: number;
    precision: number;
    recall: number;
    f1Score: number;
}

export interface Vec3 {
    x: number;
    y: number;
    z: number;
} 