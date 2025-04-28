import { CommandExecutionResult, ModelUpdates, ModelArchitecture, ValidationMetrics } from './types';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import { join } from 'path';
import { promises as fs } from 'fs';

// Set backend to WASM
tf.setBackend('wasm');

export class MLModelTrainer {
    private model: tf.LayersModel | null;
    private readonly modelDir: string;
    private readonly batchSize: number;
    private readonly epochs: number;
    private readonly validationSplit: number;

    constructor(
        modelDir: string = 'models',
        batchSize: number = 32,
        epochs: number = 10,
        validationSplit: number = 0.2
    ) {
        this.model = null;
        this.modelDir = modelDir;
        this.batchSize = batchSize;
        this.epochs = epochs;
        this.validationSplit = validationSplit;
    }

    public async initializeModel(architecture: ModelArchitecture): Promise<void> {
        const sequentialModel = tf.sequential();

        // Add layers based on architecture
        for (const layer of architecture.layers) {
            sequentialModel.add(tf.layers.dense({
                units: layer.units,
                activation: layer.activation as any,
                inputShape: layer === architecture.layers[0] ? [100] : undefined
            }));
        }

        // Compile model
        sequentialModel.compile({
            optimizer: architecture.optimizer as any,
            loss: architecture.lossFunction,
            metrics: ['accuracy']
        });

        this.model = sequentialModel;
    }

    public async trainModel(data: CommandExecutionResult[]): Promise<ModelUpdates> {
        if (!this.model) {
            throw new Error('Model not initialized');
        }

        // Prepare training data
        const { features, labels } = this.prepareTrainingData(data);

        // Train model
        const history = await this.model.fit(features, labels, {
            batchSize: this.batchSize,
            epochs: this.epochs,
            validationSplit: this.validationSplit,
            callbacks: {
                onEpochEnd: async (epoch, logs) => {
                    console.log(`Epoch ${epoch + 1}/${this.epochs}`);
                    console.log(`Loss: ${logs?.loss}, Accuracy: ${logs?.acc}`);
                }
            }
        });

        // Get validation metrics
        const validationMetrics: ValidationMetrics = {
            accuracy: history.history.val_acc ? (history.history.val_acc[this.epochs - 1] as tf.Tensor).dataSync()[0] : 0,
            loss: history.history.val_loss ? (history.history.val_loss[this.epochs - 1] as tf.Tensor).dataSync()[0] : 0,
            precision: 0,
            recall: 0,
            f1Score: 0
        };

        // Get model updates
        const updates: ModelUpdates = {
            modelId: Date.now().toString(),
            updates: {
                weights: await this.getWeights(),
                biases: await this.getBiases(),
                architecture: this.getArchitecture()
            },
            validationMetrics
        };

        return updates;
    }

    private prepareTrainingData(data: CommandExecutionResult[]): { features: tf.Tensor, labels: tf.Tensor } {
        // Convert command execution results to tensors
        const features = data.map(result => this.extractFeatures(result));
        const labels = data.map(result => result.success ? 1 : 0);

        return {
            features: tf.tensor2d(features),
            labels: tf.tensor1d(labels)
        };
    }

    private extractFeatures(result: CommandExecutionResult): number[] {
        // Extract relevant features from command execution result
        return [
            result.metrics.accuracy,
            result.metrics.efficiency,
            result.metrics.satisfaction,
            result.resources.cpu.average,
            result.resources.memory.average,
            result.resources.network.latency,
            // Add more features as needed
        ];
    }

    private async getWeights(): Promise<number[]> {
        if (!this.model) {
            throw new Error('Model not initialized');
        }

        const weights = await this.model.getWeights();
        return Array.from(weights[0].dataSync() as Float32Array);
    }

    private async getBiases(): Promise<number[]> {
        if (!this.model) {
            throw new Error('Model not initialized');
        }

        const weights = await this.model.getWeights();
        return Array.from(weights[1].dataSync() as Float32Array);
    }

    private getArchitecture(): ModelArchitecture {
        if (!this.model) {
            throw new Error('Model not initialized');
        }

        const layers = this.model.layers.map(layer => ({
            type: layer.getClassName(),
            units: (layer as any).units,
            activation: (layer as any).activation
        }));

        return {
            layers,
            optimizer: (this.model.optimizer as any).getClassName(),
            lossFunction: (this.model.loss as any).getClassName()
        };
    }

    public async saveModel(name: string): Promise<void> {
        if (!this.model) {
            throw new Error('Model not initialized');
        }

        const modelPath = join(this.modelDir, name);
        await this.model.save(`file://${modelPath}`);
    }

    public async loadModel(name: string): Promise<void> {
        const modelPath = join(this.modelDir, name);
        this.model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
    }

    public async evaluateModel(data: CommandExecutionResult[]): Promise<ValidationMetrics> {
        if (!this.model) {
            throw new Error('Model not initialized');
        }

        const { features, labels } = this.prepareTrainingData(data);
        const evaluation = this.model.evaluate(features, labels) as [tf.Tensor, tf.Tensor];

        return {
            accuracy: evaluation[1].dataSync()[0],
            loss: evaluation[0].dataSync()[0],
            precision: 0, // These would need to be calculated separately
            recall: 0,
            f1Score: 0
        };
    }
} 