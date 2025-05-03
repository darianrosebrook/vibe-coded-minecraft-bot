import { Vec3 } from 'vec3';
import { saveModel, loadModel, deserializeModel } from './serialization';

// State space definition
export interface MinecraftState {
    position: Vec3;
    inventory: {
        items: Array<{
            type: string;
            quantity: number;
        }>;
        totalSlots: number;
        usedSlots: number;
    };
    health: number;
    food: number;
    nearbyBlocks: Array<{
        type: string;
        position: Vec3;
    }>;
    nearbyEntities: Array<{
        type: string;
        position: Vec3;
    }>;
    biome: number;
    timeOfDay: number;
}

// Action space definition
export interface MinecraftAction {
    type: 'move' | 'mine' | 'place' | 'craft' | 'interact';
    parameters: {
        target?: Vec3;
        blockType?: string;
        itemType?: string;
        quantity?: number;
    };
}

// Reward function interface
export interface RewardFunction {
    (state: MinecraftState, action: MinecraftAction, nextState: MinecraftState): number;
}

// Experience replay buffer
export interface Experience {
    state: MinecraftState;
    action: MinecraftAction;
    reward: number;
    nextState: MinecraftState;
    done: boolean;
}

// Q-learning parameters
export interface QLearningConfig {
    learningRate: number;
    discountFactor: number;
    epsilon: number;
    epsilonDecay: number;
    minEpsilon: number;
    batchSize: number;
    replayBufferSize: number;
    targetUpdateFrequency: number;
}

// Base Q-learning agent
export abstract class BaseQLearningAgent {
    protected qTable: Map<string, Map<string, number>> = new Map();
    protected config: QLearningConfig;
    protected replayBuffer: Array<{
        state: any;
        action: any;
        reward: number;
        nextState: any;
        done: boolean;
    }> = [];

    constructor(config: QLearningConfig) {
        this.config = config;
    }

    protected abstract stateToKey(state: MinecraftState): string;
    protected abstract actionToKey(action: MinecraftAction): string;

    protected getQValue(state: MinecraftState, action: MinecraftAction): number {
        const stateKey = this.stateToKey(state);
        const actionKey = this.actionToKey(action);
        
        if (!this.qTable.has(stateKey)) {
            this.qTable.set(stateKey, new Map());
        }
        
        const stateActions = this.qTable.get(stateKey)!;
        return stateActions.get(actionKey) || 0;
    }

    protected setQValue(state: MinecraftState, action: MinecraftAction, value: number): void {
        const stateKey = this.stateToKey(state);
        const actionKey = this.actionToKey(action);
        
        if (!this.qTable.has(stateKey)) {
            this.qTable.set(stateKey, new Map());
        }
        
        this.qTable.get(stateKey)!.set(actionKey, value);
    }

    protected getMaxQValue(state: MinecraftState): number {
        const stateKey = this.stateToKey(state);
        const stateActions = this.qTable.get(stateKey);
        
        if (!stateActions) return 0;
        
        return Math.max(...Array.from(stateActions.values()));
    }

    public abstract selectAction(state: MinecraftState): MinecraftAction;
    public abstract update(experience: Experience): void;
    public async saveModel(filePath: string): Promise<void> {
        await saveModel(this, filePath);
    }
    public async loadModel(filePath: string): Promise<void> {
        const model = await loadModel(filePath);
        deserializeModel(model, this);
    }

    // Add getters for serialization
    public getQTable(): Map<string, Map<string, number>> {
        return this.qTable;
    }

    public getConfig(): QLearningConfig {
        return this.config;
    }

    public getReplayBuffer(): Array<{
        state: any;
        action: any;
        reward: number;
        nextState: any;
        done: boolean;
    }> {
        return this.replayBuffer;
    }

    public setReplayBuffer(buffer: Array<{
        state: any;
        action: any;
        reward: number;
        nextState: any;
        done: boolean;
    }>): void {
        this.replayBuffer = buffer;
    }
} 