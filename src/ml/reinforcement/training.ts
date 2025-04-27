import { Bot } from 'mineflayer';
import { Entity } from 'prismarine-entity';
import { MiningStrategyAgent } from './mining';
import { MinecraftState, MinecraftAction, Experience, QLearningConfig } from './base';
import { Vec3 } from 'vec3';
import { goals } from 'mineflayer-pathfinder'; 

export class MiningTrainingEnvironment {
    private agent: MiningStrategyAgent;
    private bot: Bot;
    private currentEpisode: number;
    private maxEpisodes: number;
    private episodeLength: number;
    private currentStep: number;
    private lastState: MinecraftState | null;

    constructor(
        bot: Bot,
        config: QLearningConfig,
        maxEpisodes: number = 1000,
        episodeLength: number = 1000
    ) {
        this.bot = bot;
        this.agent = new MiningStrategyAgent(config);
        this.maxEpisodes = maxEpisodes;
        this.episodeLength = episodeLength;
        this.currentEpisode = 0;
        this.currentStep = 0;
        this.lastState = null;
    }

    private getCurrentState(): MinecraftState {
        return {
            position: this.bot.entity.position,
            inventory: {
                items: this.bot.inventory.items().map(item => ({
                    type: item.name,
                    quantity: item.count
                })),
                totalSlots: this.bot.inventory.inventoryEnd - this.bot.inventory.inventoryStart,
                usedSlots: this.bot.inventory.items().length
            },
            health: this.bot.health,
            food: this.bot.food,
            nearbyBlocks: this.bot.findBlocks({
                matching: block => true,
                maxDistance: 16,
                count: 100
            }).map(block => ({
                type: this.bot.blockAt(block)?.name || 'unknown',
                position: block
            })),
            nearbyEntities: Object.values(this.bot.entities)
                .filter((entity: Entity) => entity.position.distanceTo(this.bot.entity.position) < 16)
                .map((entity: Entity) => ({
                    type: entity.name || 'unknown',
                    position: entity.position
                })),
            biome: this.bot.world.getBiome(this.bot.entity.position),
            timeOfDay: this.bot.time.timeOfDay
        };
    }

    private async executeAction(action: MinecraftAction): Promise<void> {
        switch (action.type) {
            case 'mine':
                if (action.parameters.target) {
                    const block = this.bot.blockAt(action.parameters.target);
                    if (block) {
                        await this.bot.dig(block);
                    }
                }
                break;
            case 'move':
                if (action.parameters.target) {
                    const goal = new goals.GoalNear(
                        action.parameters.target.x,
                        action.parameters.target.y,
                        action.parameters.target.z,
                        1
                    );
                    await this.bot.pathfinder.goto(goal);
                }
                break;
            // Add more action types as needed
        }
    }

    private isEpisodeDone(): boolean {
        return this.currentStep >= this.episodeLength ||
               this.bot.health <= 0 ||
               this.bot.inventory.items().length >= this.bot.inventory.inventoryEnd - this.bot.inventory.inventoryStart;
    }

    public async train(): Promise<void> {
        while (this.currentEpisode < this.maxEpisodes) {
            console.log(`Starting episode ${this.currentEpisode + 1}/${this.maxEpisodes}`);
            
            // Reset environment
            this.currentStep = 0;
            this.lastState = this.getCurrentState();
            
            while (!this.isEpisodeDone()) {
                // Select and execute action
                const action = this.agent.selectAction(this.lastState);
                await this.executeAction(action);
                
                // Get new state
                const newState = this.getCurrentState();
                
                // Create experience
                const experience: Experience = {
                    state: this.lastState,
                    action: action,
                    reward: this.agent.calculateMiningReward(this.lastState, action, newState),
                    nextState: newState,
                    done: this.isEpisodeDone()
                };
                
                // Update agent
                this.agent.update(experience);
                
                // Update state
                this.lastState = newState;
                this.currentStep++;
                
                // Log progress
                if (this.currentStep % 100 === 0) {
                    console.log(`Episode ${this.currentEpisode + 1}, Step ${this.currentStep}`);
                }
            }
            
            this.currentEpisode++;
            
            // Save model periodically
            if (this.currentEpisode % 10 === 0) {
                await this.agent.saveModel(`models/mining_agent_episode_${this.currentEpisode}.json`);
            }
        }
    }

    public async evaluate(numEpisodes: number = 10): Promise<number> {
        let totalReward = 0;
        
        for (let i = 0; i < numEpisodes; i++) {
            console.log(`Evaluation episode ${i + 1}/${numEpisodes}`);
            
            this.currentStep = 0;
            this.lastState = this.getCurrentState();
            
            while (!this.isEpisodeDone()) {
                const action = this.agent.selectAction(this.lastState);
                await this.executeAction(action);
                
                const newState = this.getCurrentState();
                totalReward += this.agent.calculateMiningReward(this.lastState, action, newState);
                
                this.lastState = newState;
                this.currentStep++;
            }
        }
        
        return totalReward / numEpisodes;
    }
} 