import { Vec3 } from 'vec3';
import { GameState } from '../../llm/context/manager';
import { ContextManager } from '../../llm/context/manager';
import { mlMetrics } from '../../utils/observability/metrics';
import { ResourceNeedPredictor, PlayerRequestPredictor, TaskDurationPredictor } from './models';
import { EnhancedGameState } from '@/types/ml/state';
import { MinecraftBot } from '../../bot/bot';
import { Bot as MineflayerBot } from 'mineflayer';
import { IMLStateManager } from '@/types/ml/interfaces';
import logger from '@/utils/observability/logger';

export interface MLStatePrediction {
  resourceNeeds: {
    type: string;
    quantity: number;
    confidence: number;
  }[];
  playerRequests: {
    type: string;
    confidence: number;
    expectedTime: number;
  }[];
  taskDurations: {
    taskType: string;
    expectedDuration: number;
    confidence: number;
  }[];
}

interface ContextWeight {
  relevance: number;
  temporalDecay: number;
  priority: number;
}

// State space definition
export interface MinecraftState {
  timestamp?: number;
  players?: Record<string, { username: string; position: Vec3 }>;
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
    distance: number;
  }>;
  biome: {
    name: string;
    temperature: number;
    rainfall: number;
  };
  timeOfDay: number;
  isRaining?: boolean;
  movement?: {
    velocity: Vec3;
    yaw: number;
    pitch: number;
    control: {
      sprint: boolean;
      sneak: boolean;
    };
  };
  environment?: {
    blockAtFeet: string;
    blockAtHead: string;
    lightLevel: number;
    isInWater: boolean;
    onGround: boolean;
  };
  recentTasks?: Array<{
    type: string;
    parameters: Record<string, any>;
    status: 'success' | 'failure' | 'in_progress';
    timestamp: number;
  }>;
}

export class MLStateManager implements IMLStateManager {
  private contextManager: ContextManager;
  private predictions: MLStatePrediction;
  private contextWeights: Map<string, ContextWeight>;
  private lastUpdateTime: number;
  private predictionInterval: number;
  private decayRate: number;
  private resourceNeedPredictor: ResourceNeedPredictor;
  private playerRequestPredictor: PlayerRequestPredictor;
  private taskDurationPredictor: TaskDurationPredictor;
  private bot: MinecraftBot;
  private mineflayerBot: MineflayerBot;
  private gameState: MinecraftState;
  private isInitialized: boolean = false;

  constructor(bot: MinecraftBot) {
    this.bot = bot;
    this.mineflayerBot = bot.getMineflayerBot();
    this.gameState = this.initializeGameState();
    this.contextManager = new ContextManager(this.mineflayerBot);
    this.predictionInterval = 5000; // 5 seconds
    this.decayRate = 0.1; // 10% decay per interval
    this.lastUpdateTime = Date.now();
    this.predictions = {
      resourceNeeds: [],
      playerRequests: [],
      taskDurations: []
    };
    this.contextWeights = new Map();

    // Initialize predictors
    this.resourceNeedPredictor = new ResourceNeedPredictor();
    this.playerRequestPredictor = new PlayerRequestPredictor();
    this.taskDurationPredictor = new TaskDurationPredictor();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Starting MLStateManager initialization', {
        position: this.mineflayerBot.entity.position,
        health: this.mineflayerBot.health,
        food: this.mineflayerBot.food
      });

      // Initialize basic state without heavy scanning
      this.gameState = {
        position: this.mineflayerBot.entity.position,
        health: this.mineflayerBot.health,
        food: this.mineflayerBot.food,
        inventory: {
          items: [],
          totalSlots: 36,
          usedSlots: 0
        },
        biome: {
          name: 'unknown',
          temperature: 0,
          rainfall: 0
        },
        timeOfDay: this.mineflayerBot.time.timeOfDay,
        nearbyBlocks: [],
        nearbyEntities: [],
        movement: {
          velocity: this.mineflayerBot.entity.velocity,
          yaw: this.mineflayerBot.entity.yaw,
          pitch: this.mineflayerBot.entity.pitch,
          control: {
            sprint: false,
            sneak: false
          }
        },
        environment: {
          blockAtFeet: 'unknown',
          blockAtHead: 'unknown',
          lightLevel: 0,
          isInWater: false,
          onGround: this.mineflayerBot.entity.onGround
        },
        recentTasks: []
      };

      logger.info('Basic state initialized', {
        position: this.gameState.position,
        health: this.gameState.health,
        food: this.gameState.food
      });

      // Schedule the first state update
      setTimeout(() => this.updateStateAsync(), 1000);
      
      this.isInitialized = true;
      logger.info('MLStateManager initialization completed', {
        predictionInterval: this.predictionInterval,
        decayRate: this.decayRate
      });
    } catch (error) {
      logger.error('Failed to initialize MLStateManager', { error });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    this.isInitialized = false;
    logger.info('MLStateManager shut down successfully');
  }

  public async predictState(): Promise<any> {
    try {
      await this.updatePredictions(this.convertToGameState(await this.getState()));
      return this.predictions;
    } catch (error) {
      logger.error('Failed to predict state', { error });
      throw error;
    }
  }

  public async getState(): Promise<EnhancedGameState> {
    const timestamp = Date.now();
    this.gameState.timestamp = timestamp;
    this.gameState.players = {};
    for (const player of Object.values(this.mineflayerBot.players)) {
      this.gameState.players[player.username] = {
        username: player.username,
        position: player.entity.position,
      };
    } 
    
    // Transform MinecraftState to EnhancedGameState
    const enhancedGameState: EnhancedGameState = {
      botState: {
        position: this.gameState.position,
        velocity: this.mineflayerBot.entity.velocity,
        inventory: {
          items: this.gameState.inventory.items.map(item => ({
            type: item.type,
            quantity: item.quantity,
            metadata: {
              durability: (item as any).durability || 0,
              enchantments: (item as any).enchantments || [],
              nbt: (item as any).nbt || {}
            }
          })),
          size: this.gameState.inventory.totalSlots - this.gameState.inventory.usedSlots
        },
        health: this.gameState.health,
        food: this.gameState.food,
        experience: 0, // Default value
        selectedItem: this.mineflayerBot.heldItem?.name || '',
        onGround: this.mineflayerBot.entity.onGround
      },
      worldState: {
        time: this.gameState.timeOfDay,
        weather: this.gameState.isRaining ? 'rain' : 'clear',
        difficulty: 'normal', // Default value
        dimension: this.gameState.biome.name,
      },
      nearbyEntities: this.gameState.nearbyEntities.map(entity => ({
        type: entity.type,
        position: entity.position,
      })),
      nearbyBlocks: this.gameState.nearbyBlocks.map(block => ({
        type: block.type,
        position: block.position,
      })),
      resourceState: {
        available: {},
        required: {},
        dependencies: [],
      },
      craftingState: {
        recipes: [],
        available: {},
      },
      playerBehavior: {
        lastAction: '',
        actionHistory: [],
        preferences: {},
        skillLevel: 0,
      },
      environmentalFactors: [],
      taskHistory: this.gameState.recentTasks?.map(task => ({
        taskId: '',
        type: task.type,
        status: task.status === 'success' ? 'completed' : task.status === 'failure' ? 'failed' : 'in_progress',
        startTime: task.timestamp,
        resourcesUsed: {},
        success: task.status === 'success',
      })) || [],
      resourceImpact: [],
      nearbyResources: [],
      terrainAnalysis: {
        elevation: this.gameState.position.y,
        biome: this.gameState.biome.name,
        difficulty: 0,
        safety: 0,
      },
      mobPresence: {
        type: '',
        count: 0,
        distance: 0,
        threatLevel: 0,
      }
    };
    
    return enhancedGameState;
  }

  public convertToGameState(enhancedState: EnhancedGameState): GameState {
    const biome = this.bot.getBiomeAt(enhancedState.botState.position);

    return {
      position: enhancedState.botState.position,
      health: this.mineflayerBot.health,
      food: this.mineflayerBot.food,
      inventory: {
        items: this.mineflayerBot.inventory.items().map(item => ({
          type: item.name,
          quantity: item.count,
          metadata: {
            durability: item.maxDurability,
            enchantments: item.enchants,
            nbt: item.nbt
          }
        })),
        totalSlots: 36,
        usedSlots: this.mineflayerBot.inventory.items().length
      },
      biome: biome || 'unknown',
      timeOfDay: this.mineflayerBot.time.timeOfDay,
      isRaining: this.mineflayerBot.isRaining,
      nearbyBlocks: this.mineflayerBot.findBlocks({
        maxDistance: 16,
        count: 10,
        matching: () => true
      }).map(block => ({
        type: this.mineflayerBot.blockAt(block)?.name || 'unknown',
        position: block
      })),
      nearbyEntities: Object.values(this.gameState.players || {}).map(player => ({
        type: 'player', 
        position: player.position,
        distance: player.position.distanceTo(this.gameState.position)
      })),
      movement: {
        velocity: this.mineflayerBot.entity.velocity,
        yaw: this.mineflayerBot.entity.yaw,
        pitch: this.mineflayerBot.entity.pitch,
        control: {
          sprint: this.mineflayerBot.controlState.sprint,
          sneak: this.mineflayerBot.controlState.sneak
        }
      },
      environment: {
        blockAtFeet: this.mineflayerBot.blockAt(this.mineflayerBot.entity.position.offset(0, -1, 0))?.name || 'unknown',
        blockAtHead: this.mineflayerBot.blockAt(this.mineflayerBot.entity.position.offset(0, 1, 0))?.name || 'unknown',
        lightLevel: this.mineflayerBot.blockAt(this.mineflayerBot.entity.position)?.light || 0,
        isInWater: !this.mineflayerBot.entity.onGround,
        onGround: this.mineflayerBot.entity.onGround
      },
      recentTasks: []
    };
  }

  public updateState(state: Partial<EnhancedGameState>): void {
    // Update MinecraftState properties from EnhancedGameState
    if (state.botState) {
      if (state.botState.position) this.gameState.position = state.botState.position;
      if (state.botState.health) this.gameState.health = state.botState.health;
      if (state.botState.food) this.gameState.food = state.botState.food;
      if (state.botState.inventory) {
        this.gameState.inventory.items = state.botState.inventory.items.map(item => ({
          type: item.type,
          quantity: item.quantity
        }));
      }
    }

    if (state.worldState) {
      if (state.worldState.time) this.gameState.timeOfDay = state.worldState.time;
      if (state.worldState.weather) this.gameState.isRaining = state.worldState.weather === 'rain';
      if (state.worldState.dimension) this.gameState.biome.name = state.worldState.dimension;
    }

    if (state.nearbyBlocks) {
      this.gameState.nearbyBlocks = state.nearbyBlocks.map(block => ({
        type: block.type,
        position: block.position
      }));
    }

    if (state.nearbyEntities) {
      this.gameState.nearbyEntities = state.nearbyEntities.map(entity => ({
        type: entity.type,
        position: entity.position,
        distance: entity.position.distanceTo(this.gameState.position)
      }));
    }

    if (state.taskHistory) {
      this.gameState.recentTasks = state.taskHistory.map(task => ({
        type: task.type,
        parameters: {},
        status: task.status === 'completed' ? 'success' : task.status === 'failed' ? 'failure' : 'in_progress',
        timestamp: task.startTime
      }));
    }
  }

  public async updateStateAsync(): Promise<void> {
    const currentTime = Date.now();
    if (currentTime - this.lastUpdateTime < this.predictionInterval) {
      return;
    }

    try {
      logger.debug('Starting state update', {
        timeSinceLastUpdate: currentTime - this.lastUpdateTime,
        position: this.mineflayerBot.entity.position
      });

      // Update basic state information
      this.gameState.position = this.mineflayerBot.entity.position;
      this.gameState.health = this.mineflayerBot.health;
      this.gameState.food = this.mineflayerBot.food;
      this.gameState.timeOfDay = this.mineflayerBot.time.timeOfDay;
      this.gameState.isRaining = this.mineflayerBot.isRaining;

      logger.debug('Basic state updated', {
        health: this.gameState.health,
        food: this.gameState.food,
        timeOfDay: this.gameState.timeOfDay,
        isRaining: this.gameState.isRaining
      });

      // Update inventory (lightweight operation)
      const items = this.mineflayerBot.inventory.items();
      this.gameState.inventory = {
        items: items.map(item => ({
          type: item.name,
          quantity: item.count
        })),
        totalSlots: 36,
        usedSlots: items.length
      };

      logger.debug('Inventory updated', {
        itemCount: items.length,
        usedSlots: this.gameState.inventory.usedSlots
      });

      // Update nearby entities (within a smaller radius)
      const nearbyEntities = Object.values(this.mineflayerBot.entities)
        .filter(e => e !== this.mineflayerBot.entity && e.position.distanceTo(this.mineflayerBot.entity.position) < 16)
        .map(e => ({
          type: e.type,
          position: e.position,
          distance: e.position.distanceTo(this.mineflayerBot.entity.position)
        }));
      this.gameState.nearbyEntities = nearbyEntities;

      logger.debug('Nearby entities updated', {
        entityCount: nearbyEntities.length,
        types: [...new Set(nearbyEntities.map(e => e.type))]
      });

      // Update nearby blocks (only immediate surroundings)
      const pos = this.mineflayerBot.entity.position;
      const nearbyBlocks = [];
      for (let y = -1; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          for (let z = -2; z <= 2; z++) {
            const block = this.mineflayerBot.blockAt(pos.offset(x, y, z));
            if (block && block.type !== 0) { // Skip air blocks
              nearbyBlocks.push({
                type: block.name,
                position: block.position
              });
            }
          }
        }
      }
      this.gameState.nearbyBlocks = nearbyBlocks;

      logger.debug('Nearby blocks updated', {
        blockCount: nearbyBlocks.length,
        types: [...new Set(nearbyBlocks.map(b => b.type))]
      });

      // Update environment
      this.gameState.environment = {
        blockAtFeet: this.mineflayerBot.blockAt(pos.offset(0, -1, 0))?.name || 'unknown',
        blockAtHead: this.mineflayerBot.blockAt(pos.offset(0, 1, 0))?.name || 'unknown',
        lightLevel: this.mineflayerBot.blockAt(pos)?.light || 0,
        isInWater: !this.mineflayerBot.entity.onGround && this.mineflayerBot.blockAt(pos)?.name === 'water',
        onGround: this.mineflayerBot.entity.onGround
      };

      logger.debug('Environment updated', {
        blockAtFeet: this.gameState.environment.blockAtFeet,
        blockAtHead: this.gameState.environment.blockAtHead,
        lightLevel: this.gameState.environment.lightLevel,
        isInWater: this.gameState.environment.isInWater,
        onGround: this.gameState.environment.onGround
      });

      await this.updatePredictions(this.convertToGameState(await this.getState()));
      await this.updateContextWeights(this.convertToGameState(await this.getState()));

      this.lastUpdateTime = currentTime;

      logger.info('State update completed', {
        updateDuration: Date.now() - currentTime,
        nextUpdateIn: this.predictionInterval
      });

      // Schedule next update
      setTimeout(() => this.updateStateAsync(), this.predictionInterval);
    } catch (error) {
      logger.error('Error updating state:', error);
    }
  }

  private async updatePredictions(gameState: GameState): Promise<void> {
    const startTime = Date.now();

    // Predict resource needs based on current state and recent tasks
    this.predictions.resourceNeeds = await this.resourceNeedPredictor.predict(gameState);
    mlMetrics.predictionLatency.observe(
      { type: 'resource_needs' },
      (Date.now() - startTime) / 1000
    );

    // Predict likely player requests based on context
    this.predictions.playerRequests = await this.playerRequestPredictor.predict(gameState);
    mlMetrics.predictionLatency.observe(
      { type: 'player_requests' },
      (Date.now() - startTime) / 1000
    );

    // Predict task durations based on historical data
    this.predictions.taskDurations = await this.taskDurationPredictor.predict(gameState);
    mlMetrics.predictionLatency.observe(
      { type: 'task_durations' },
      (Date.now() - startTime) / 1000
    );

    // Update prediction accuracy metrics
    this.updatePredictionAccuracy();
  }

  private updatePredictionAccuracy(): void {
    // Calculate and update accuracy metrics for each prediction type
    const resourceAccuracy = this.calculateResourcePredictionAccuracy();
    const requestAccuracy = this.calculateRequestPredictionAccuracy();
    const durationAccuracy = this.calculateDurationPredictionAccuracy();

    mlMetrics.predictionAccuracy.set({ type: 'resource_needs' }, resourceAccuracy);
    mlMetrics.predictionAccuracy.set({ type: 'player_requests' }, requestAccuracy);
    mlMetrics.predictionAccuracy.set({ type: 'task_durations' }, durationAccuracy);
  }

  private calculateResourcePredictionAccuracy(): number {
    // TODO: Implement actual accuracy calculation based on historical data
    return 0.8; // Placeholder
  }

  private calculateRequestPredictionAccuracy(): number {
    // TODO: Implement actual accuracy calculation based on historical data
    return 0.7; // Placeholder
  }

  private calculateDurationPredictionAccuracy(): number {
    // TODO: Implement actual accuracy calculation based on historical data
    return 0.75; // Placeholder
  }

  private async updateContextWeights(gameState: GameState): Promise<void> {
    // Update weights for different context aspects
    const aspects = ['inventory', 'position', 'health', 'nearbyEntities', 'timeOfDay'];

    for (const aspect of aspects) {
      const weight = await this.calculateContextWeight(aspect, gameState);
      this.contextWeights.set(aspect, weight);
    }
  }

  private async calculateContextWeight(
    aspect: string,
    gameState: GameState
  ): Promise<ContextWeight> {
    // Calculate weight based on aspect importance and recent changes
    let relevance = 1.0;
    let priority = 1.0;

    switch (aspect) {
      case 'inventory':
        // Higher weight if inventory is getting full
        const inventoryRatio = gameState.inventory.usedSlots / gameState.inventory.totalSlots;
        relevance = Math.min(1.0, inventoryRatio * 1.5);
        priority = inventoryRatio > 0.8 ? 1.5 : 1.0;
        break;
      case 'health':
        // Higher weight if health is low
        relevance = Math.max(0.5, 1.0 - (gameState.health / 20));
        priority = gameState.health < 10 ? 1.5 : 1.0;
        break;
      case 'nearbyEntities':
        // Higher weight if there are nearby entities
        relevance = Math.min(1.0, gameState.nearbyEntities.length / 10);
        priority = gameState.nearbyEntities.some(e => e.type === 'hostile') ? 1.5 : 1.0;
        break;
      case 'timeOfDay':
        // Higher weight during dangerous times (night)
        const isDay = gameState.timeOfDay < 13000 || gameState.timeOfDay > 23000;
        relevance = isDay ? 0.5 : 1.0;
        priority = isDay ? 1.0 : 1.2;
        break;
    }

    return {
      relevance,
      temporalDecay: this.decayRate,
      priority
    };
  }

  public getPredictions(): MLStatePrediction {
    return this.predictions;
  }

  public getContextWeights(): Map<string, ContextWeight> {
    return this.contextWeights;
  }

  private initializeGameState(): MinecraftState {
    return {
      position: new Vec3(0, 64, 0),
      health: 20,
      food: 20,
      inventory: {
        items: [],
        totalSlots: 36,
        usedSlots: 0
      },
      biome: {
        name: 'plains',
        temperature: 0.8,
        rainfall: 0.4
      },
      timeOfDay: 0,
      nearbyBlocks: [],
      nearbyEntities: [],
      movement: {
        velocity: new Vec3(0, 0, 0),
        yaw: 0,
        pitch: 0,
        control: {
          sprint: false,
          sneak: false
        }
      },
      environment: {
        blockAtFeet: 'grass',
        blockAtHead: 'air',
        lightLevel: 15,
        isInWater: false,
        onGround: true
      },
      recentTasks: []
    };
  }
} 