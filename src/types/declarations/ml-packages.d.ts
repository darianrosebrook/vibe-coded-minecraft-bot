declare module 'ml-cart' {
  export class DecisionTreeClassifier {
    constructor(options: {
      gainFunction?: 'gini' | 'entropy';
      maxDepth?: number;
      minNumSamples?: number;
    });
    train(features: number[][], labels: number[]): void;
    predict(features: number[][]): number[];
  }
}

declare module 'ml-random-forest' {
  export class RandomForestClassifier {
    constructor(options: {
      maxFeatures?: number;
      nEstimators?: number;
      maxDepth?: number;
      minSamplesSplit?: number;
      minSamplesLeaf?: number;
    });
    train(features: number[][], labels: number[]): void;
    predict(features: number[][]): number[];
  }
}

declare module 'brain.js' {
  export class NeuralNetwork {
    constructor(options: {
      hiddenLayers?: number[];
      activation?: 'sigmoid' | 'relu' | 'leaky-relu' | 'tanh';
      learningRate?: number;
    });
    train(data: Array<{ input: number[]; output: number[] }>, options?: {
      iterations?: number;
      errorThresh?: number;
      log?: boolean;
      logPeriod?: number;
    }): Promise<{ error: number; iterations: number }>;
    run(input: number[]): number[];
  }
} 