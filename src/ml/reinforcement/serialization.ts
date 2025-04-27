import { BaseQLearningAgent, QLearningConfig } from './base';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SerializedModel {
    config: QLearningConfig;
    qTable: Array<{
        stateKey: string;
        actions: Array<{
            actionKey: string;
            qValue: number;
        }>;
    }>;
    replayBuffer: Array<{
        state: any;
        action: any;
        reward: number;
        nextState: any;
        done: boolean;
    }>;
}

export async function saveModel(agent: BaseQLearningAgent, filePath: string): Promise<void> {
    try {
        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Convert Q-table to serializable format
        const serializedQTable = Array.from(agent.getQTable().entries()).map(([stateKey, actions]) => ({
            stateKey,
            actions: Array.from(actions.entries()).map(([actionKey, qValue]) => ({
                actionKey,
                qValue
            }))
        }));

        // Create serialized model
        const model: SerializedModel = {
            config: agent.getConfig(),
            qTable: serializedQTable,
            replayBuffer: agent.getReplayBuffer()
        };

        // Write to file
        await fs.writeFile(filePath, JSON.stringify(model, null, 2));
        console.log(`Model saved successfully to ${filePath}`);
    } catch (error) {
        console.error('Error saving model:', error);
        throw new Error(`Failed to save model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function loadModel(filePath: string): Promise<SerializedModel> {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const model = JSON.parse(data) as SerializedModel;

        // Validate model structure
        if (!model.config || !model.qTable || !model.replayBuffer) {
            throw new Error('Invalid model format');
        }

        console.log(`Model loaded successfully from ${filePath}`);
        return model;
    } catch (error) {
        console.error('Error loading model:', error);
        throw new Error(`Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function deserializeModel(model: SerializedModel, agent: BaseQLearningAgent): void {
    try {
        // Restore configuration
        Object.assign(agent.getConfig(), model.config);

        // Restore Q-table
        agent.getQTable().clear();
        for (const { stateKey, actions } of model.qTable) {
            const actionMap = new Map();
            for (const { actionKey, qValue } of actions) {
                actionMap.set(actionKey, qValue);
            }
            agent.getQTable().set(stateKey, actionMap);
        }

        // Restore replay buffer
        agent.setReplayBuffer(model.replayBuffer);

        console.log('Model deserialized successfully');
    } catch (error) {
        console.error('Error deserializing model:', error);
        throw new Error(`Failed to deserialize model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
} 