export * from './base';
export * from './mining';
export * from './training';

// Default Q-learning configuration
export const defaultQLearningConfig = {
    learningRate: 0.1,
    discountFactor: 0.99,
    epsilon: 1.0,
    epsilonDecay: 0.995,
    minEpsilon: 0.01,
    batchSize: 32,
    replayBufferSize: 10000,
    targetUpdateFrequency: 1000
}; 