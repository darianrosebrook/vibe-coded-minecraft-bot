import { BaseQLearningAgent, MinecraftState, MinecraftAction, Experience, QLearningConfig } from './base';
import { Vec3 } from 'vec3';

export class MiningStrategyAgent extends BaseQLearningAgent {
    private miningRewardWeights = {
        blockValue: 1.0,
        efficiency: 0.5,
        safety: 0.3,
        inventorySpace: 0.2
    };

    constructor(config: QLearningConfig) {
        super(config);
    }

    protected stateToKey(state: MinecraftState): string {
        // Create a simplified state representation for mining
        const nearbyOres = state.nearbyBlocks
            .filter(block => this.isValuableOre(block.type))
            .map(block => `${block.type}:${block.position.x},${block.position.y},${block.position.z}`)
            .join('|');
        
        const inventorySpace = state.inventory.totalSlots - state.inventory.usedSlots;
        
        return `${state.biome}:${inventorySpace}:${nearbyOres}`;
    }

    protected actionToKey(action: MinecraftAction): string {
        if (action.type === 'mine' && action.parameters.target) {
            return `mine:${action.parameters.target.x},${action.parameters.target.y},${action.parameters.target.z}`;
        }
        return `${action.type}:${JSON.stringify(action.parameters)}`;
    }

    private isValuableOre(blockType: string): boolean {
        const valuableOres = [
            'diamond_ore',
            'emerald_ore',
            'gold_ore',
            'iron_ore',
            'coal_ore',
            'lapis_ore',
            'redstone_ore'
        ];
        return valuableOres.includes(blockType);
    }

    public calculateMiningReward(state: MinecraftState, action: MinecraftAction, nextState: MinecraftState): number {
        let reward = 0;

        // Block value reward
        if (action.type === 'mine' && action.parameters.target) {
            const minedBlock = state.nearbyBlocks.find(
                block => block.position.equals(action.parameters.target!)
            );
            if (minedBlock && this.isValuableOre(minedBlock.type)) {
                reward += this.miningRewardWeights.blockValue;
            }
        }

        // Efficiency reward (based on inventory space usage)
        const inventorySpaceUsed = nextState.inventory.usedSlots - state.inventory.usedSlots;
        reward += (inventorySpaceUsed / state.inventory.totalSlots) * this.miningRewardWeights.efficiency;

        // Safety reward (penalize low health)
        if (nextState.health < state.health) {
            reward -= (state.health - nextState.health) * this.miningRewardWeights.safety;
        }

        // Inventory space reward
        const remainingSpace = nextState.inventory.totalSlots - nextState.inventory.usedSlots;
        reward += (remainingSpace / nextState.inventory.totalSlots) * this.miningRewardWeights.inventorySpace;

        return reward;
    }

    public selectAction(state: MinecraftState): MinecraftAction {
        // Epsilon-greedy action selection
        if (Math.random() < this.config.epsilon) {
            return this.selectRandomAction(state);
        }
        return this.selectBestAction(state);
    }

    private selectRandomAction(state: MinecraftState): MinecraftAction {
        const valuableBlocks = state.nearbyBlocks.filter(block => this.isValuableOre(block.type));
        
        if (valuableBlocks.length > 0) {
            const randomBlock = valuableBlocks[Math.floor(Math.random() * valuableBlocks.length)];
            return {
                type: 'mine',
                parameters: {
                    target: randomBlock.position
                }
            };
        }

        // If no valuable blocks nearby, move randomly
        return {
            type: 'move',
            parameters: {
                target: new Vec3(
                    state.position.x + (Math.random() * 10 - 5),
                    state.position.y,
                    state.position.z + (Math.random() * 10 - 5)
                )
            }
        };
    }

    private selectBestAction(state: MinecraftState): MinecraftAction {
        const stateKey = this.stateToKey(state);
        const stateActions = this.qTable.get(stateKey);
        
        if (!stateActions || stateActions.size === 0) {
            return this.selectRandomAction(state);
        }

        let bestAction: MinecraftAction | null = null;
        let bestQValue = -Infinity;

        // Find the action with the highest Q-value
        for (const [actionKey, qValue] of stateActions.entries()) {
            if (qValue > bestQValue) {
                bestQValue = qValue;
                // Convert action key back to action object
                const [type, params] = actionKey.split(':');
                bestAction = {
                    type: type as any,
                    parameters: JSON.parse(params)
                };
            }
        }

        return bestAction || this.selectRandomAction(state);
    }

    public update(experience: Experience): void {
        // Add experience to replay buffer
        this.replayBuffer.push(experience);
        if (this.replayBuffer.length > this.config.replayBufferSize) {
            this.replayBuffer.shift();
        }

        // Sample a batch of experiences
        const batchSize = Math.min(this.config.batchSize, this.replayBuffer.length);
        const batch = this.replayBuffer
            .sort(() => Math.random() - 0.5)
            .slice(0, batchSize);

        // Update Q-values for each experience in the batch
        for (const exp of batch) {
            const currentQ = this.getQValue(exp.state, exp.action);
            const nextMaxQ = exp.done ? 0 : this.getMaxQValue(exp.nextState);
            
            const targetQ = exp.reward + this.config.discountFactor * nextMaxQ;
            const newQ = currentQ + this.config.learningRate * (targetQ - currentQ);
            
            this.setQValue(exp.state, exp.action, newQ);
        }

        // Update epsilon
        this.config.epsilon = Math.max(
            this.config.minEpsilon,
            this.config.epsilon * this.config.epsilonDecay
        );
    }
} 