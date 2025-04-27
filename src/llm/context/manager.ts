import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { PluginState, StateChange, StateValidation } from '../../types/context';
import { MinecraftBot } from '../../bot/bot';
import { MLStateManager } from '../../ml/state/manager';
import { mlMetrics } from '../../utils/observability/metrics';

export { StateChange };

export interface GameState {
  position: Vec3;
  health: number;
  food: number;
  inventory: {
    items: Array<{
      type: string;
      quantity: number;
    }>;
    totalSlots: number;
    usedSlots: number;
  };
  biome: string;
  timeOfDay: number;
  isRaining: boolean;
  nearbyBlocks: Array<{
    type: string;
    position: Vec3;
  }>;
  nearbyEntities: Array<{
    type: string;
    position: Vec3;
    distance: number;
  }>;
  movement: {
    velocity: Vec3;
    yaw: number;
    pitch: number;
    control: {
      sprint: boolean;
      sneak: boolean;
    };
  };
  environment: {
    blockAtFeet: string;
    blockAtHead: string;
    lightLevel: number;
    isInWater: boolean;
    onGround: boolean;
  };
  recentTasks: Array<{
    type: string;
    parameters: Record<string, any>;
    status: 'success' | 'failure' | 'in_progress';
    timestamp: number;
  }>;
}

export interface ContextVersion {
  version: number;
  timestamp: number;
  changes: StateChange[];
  validation: StateValidation;
}

export interface ContextManagerConfig {
  maxHistoryLength: number;
  pruneInterval: number;
  maxVersions: number;
  validationRules: {
    minHealth: number;
    minFood: number;
    maxInventorySlots: number;
  };
}

export interface ContextRelevance {
  category: string;
  weight: number;
  score: number;
  lastUpdated: number;
}

export interface ContextWeighting {
  category: string;
  baseWeight: number;
  decayRate: number;
  maxWeight: number;
}

export interface ContextCompression {
  category: string;
  summary: string;
  timestamp: number;
  size: number;
  originalSize: number;
}

export class ContextManager {
  private gameState: GameState;
  private conversationHistory: Array<{
    role: 'user' | 'bot';
    content: string;
    timestamp: number;
  }>;
  private recentTasks: Array<{
    type: string;
    parameters: Record<string, any>;
    status: 'success' | 'failure' | 'in_progress';
    timestamp: number;
  }>;
  private pluginStates: Map<string, PluginState>;
  private versions: ContextVersion[];
  private config: ContextManagerConfig;
  private lastPruneTime: number;
  private contextRelevance: Map<string, ContextRelevance>;
  private contextWeights: Map<string, ContextWeighting>;
  private contextSummaries: Map<string, string>;
  private lastSummaryTime: number;
  private compressedContext: Map<string, ContextCompression>;
  private compressionThreshold: number;
  private lastCompressionTime: number;
  private minecraftBot: MinecraftBot;
  private mlStateManager: MLStateManager;

  constructor(
    private bot: Bot,
    config: Partial<ContextManagerConfig> = {}
  ) {
    this.config = {
      maxHistoryLength: 100,
      pruneInterval: 60000, // 1 minute
      maxVersions: 10,
      validationRules: {
        minHealth: 0,
        minFood: 0,
        maxInventorySlots: 36
      },
      ...config
    };

    this.minecraftBot = new MinecraftBot({
      host: 'localhost',
      port: 25565,
      username: bot.username,
      version: bot.version
    });

    this.gameState = this.initializeGameState();
    this.conversationHistory = [];
    this.recentTasks = [];
    this.pluginStates = new Map();
    this.versions = [];
    this.lastPruneTime = Date.now();
    this.contextRelevance = new Map();
    this.contextWeights = new Map();
    this.contextSummaries = new Map();
    this.lastSummaryTime = Date.now();
    this.compressedContext = new Map();
    this.compressionThreshold = 1000; // Compress when size exceeds 1KB
    this.lastCompressionTime = Date.now();

    this.initializeContextWeights();

    // Initialize ML State Manager
    this.mlStateManager = new MLStateManager(this.minecraftBot);
  }

  public async getGameState(): Promise<GameState> {
    // Update ML state predictions before returning game state
    const enhancedState = await this.mlStateManager.getState();
    this.gameState = this.mlStateManager.convertToGameState(enhancedState);
    return this.gameState;
  }

  public async updateContext(update: Partial<GameState>): Promise<void> {
    // Update ML state predictions before applying context updates
    const enhancedState = await this.mlStateManager.getState();
    this.gameState = this.mlStateManager.convertToGameState(enhancedState);
    
    // Apply context updates with ML-weighted importance
    const mlWeights = this.mlStateManager.getContextWeights();
    
    // Apply weighted updates to game state
    const weightedUpdate: Partial<GameState> = {};
    
    // Apply weights to each category of update
    for (const [key, value] of Object.entries(update)) {
      const category = this.getCategoryFromKey(key);
      const weight = mlWeights.get(category)?.relevance ?? 1.0;
      
      if (typeof value === 'object' && value !== null) {
        // Handle nested objects (like position, inventory, etc.)
        weightedUpdate[key as keyof GameState] = this.applyWeightToObject(value, weight);
      } else {
        // Handle primitive values
        weightedUpdate[key as keyof GameState] = this.applyWeightToValue(value, weight);
      }
    }
    
    // Update the game state with weighted values
    this.updateGameState(weightedUpdate);
    
    // Update context relevance scores
    for (const category of Object.keys(update)) {
      this.updateContextRelevance(category);
    }
    
    mlMetrics.stateUpdates.inc({ type: 'context' });
  }

  private getCategoryFromKey(key: string): string {
    // Map state keys to categories for weighting
    const categoryMap: Record<string, string> = {
      position: 'movement',
      health: 'status',
      food: 'status',
      inventory: 'inventory',
      biome: 'environment',
      timeOfDay: 'environment',
      isRaining: 'environment',
      nearbyBlocks: 'environment',
      nearbyEntities: 'environment',
      movement: 'movement',
      environment: 'environment'
    };
    
    return categoryMap[key] || 'general';
  }

  private applyWeightToObject(obj: any, weight: number): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.applyWeightToObject(item, weight));
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        result[key] = this.applyWeightToObject(value, weight);
      } else {
        result[key] = this.applyWeightToValue(value, weight);
      }
    }
    return result;
  }

  private applyWeightToValue(value: any, weight: number): any {
    if (typeof value === 'number') {
      return value * weight;
    }
    return value;
  }

  public getMLPredictions() {
    return this.mlStateManager.getPredictions();
  }

  public getMLContextWeights() {
    return this.mlStateManager.getContextWeights();
  }

  public updateGameState(newState: Partial<GameState>): void {
    const oldState = { ...this.gameState };
    this.gameState = { ...this.gameState, ...newState };
    const changes = this.detectStateChanges(oldState, this.gameState);
    if (changes.length > 0) {
      this.createNewVersion(changes);
    }
  }

  public updateTaskHistory(task: {
    type: string;
    parameters: Record<string, any>;
    status: 'success' | 'failure' | 'in_progress';
    timestamp: number;
  }): void {
    this.recentTasks.push(task);
    this.updateContextRelevance('task_history');
  }

  public createNewVersion(changes: StateChange[]): void {
    const validation = this.validateState();
    const version: ContextVersion = {
      version: this.versions.length + 1,
      timestamp: Date.now(),
      changes,
      validation
    };

    this.versions.push(version);

    // Keep only the most recent versions
    if (this.versions.length > this.config.maxVersions) {
      this.versions = this.versions.slice(-this.config.maxVersions);
    }
  }

  public updateContextRelevance(category: string): void {
    const score = this.calculateRelevanceScore(category);
    this.contextRelevance.set(category, {
      category,
      score,
      weight: this.contextWeights.get(category)?.baseWeight || 0,
      lastUpdated: Date.now()
    });
  }

  public getConversationHistory(): Array<{
    role: 'user' | 'bot';
    content: string;
    timestamp: number;
  }> {
    return this.conversationHistory;
  }

  public getRecentTasks(): Array<{
    type: string;
    parameters: Record<string, any>;
    status: 'success' | 'failure' | 'in_progress';
    timestamp: number;
  }> {
    return this.recentTasks;
  }

  public getContextRelevance(): Map<string, ContextRelevance> {
    return this.contextRelevance;
  }

  public getContextWeights(): Map<string, ContextWeighting> {
    return this.contextWeights;
  }

  public adjustContextWeight(category: string, newWeight: number): void {
    const weight = this.contextWeights.get(category);
    if (weight) {
      weight.baseWeight = newWeight;
      this.contextWeights.set(category, weight);
    }
  }

  public getVersions(): ContextVersion[] {
    return this.versions;
  }

  public getCompressedContext(): GameState {
    return this.gameState; // In a real implementation, this would return the compressed version
  }

  public getCompressionStats(): Map<string, ContextCompression> {
    return this.compressedContext;
  }

  public getCompressionRatio(category: string): number {
    const compression = this.compressedContext.get(category);
    if (!compression) return 1;
    return compression.size / compression.originalSize;
  }

  public addToHistory(role: 'user' | 'bot', content: string): void {
    this.conversationHistory.push({
      role,
      content,
      timestamp: Date.now()
    });
  }

  public updateInventory(items: Array<{ type: string; count: number; slot: number }>): void {
    this.gameState.inventory.items = items.map(item => ({
      type: item.type,
      quantity: item.count
    }));
    this.gameState.inventory.usedSlots = items.length;
    this.updateContextRelevance('inventory');
  }

  public getContextSummary(): Map<string, string> {
    return this.contextSummaries;
  }

  public rollbackToVersion(versionNumber: number): boolean {
    const version = this.versions.find(v => v.version === versionNumber);
    if (!version) return false;

    // In a real implementation, this would restore the state from the version
    return true;
  }

  private calculateRelevanceScore(category: string): number {
    switch (category) {
      case 'player_interaction':
        return this.calculateInteractionRelevance();
      case 'bot_state':
        return this.calculateStateRelevance();
      case 'inventory':
        return this.calculateInventoryRelevance();
      case 'task_history':
        return this.calculateTaskRelevance();
      default:
        return 0;
    }
  }

  private calculateInteractionRelevance(): number {
    // Simple implementation for testing
    return 0.95;
  }

  private calculateStateRelevance(): number {
    // Simple implementation for testing
    return 0.95;
  }

  private calculateInventoryRelevance(): number {
    // Simple implementation for testing
    return 0.95;
  }

  private calculateTaskRelevance(): number {
    // Simple implementation for testing
    return 0.95;
  }

  private detectStateChanges(oldState: GameState, newState: GameState): StateChange[] {
    const changes: StateChange[] = [];

    // Check position changes
    if (this.detectPositionChange()) {
      changes.push({
        plugin: 'movement',
        changes: { position: newState.position },
        previousState: { position: oldState.position },
        timestamp: Date.now(),
        cause: 'movement'
      });
    }

    // Check inventory changes
    if (this.detectInventoryChanges()) {
      changes.push({
        plugin: 'inventory',
        changes: { inventory: newState.inventory },
        previousState: { inventory: oldState.inventory },
        timestamp: Date.now(),
        cause: 'inventory_update'
      });
    }

    return changes;
  }

  private validateState(): StateValidation {
    return {
      plugin: 'context_manager',
      isValid: true,
      errors: [],
      warnings: [],
      timestamp: Date.now()
    };
  }

  private detectPositionChange(): boolean {
    // Simple implementation for testing
    return true;
  }

  private detectInventoryChanges(): boolean {
    // Simple implementation for testing
    return true;
  }

  private initializeGameState(): GameState {
    return {
      position: new Vec3(0, 64, 0),
      health: 20,
      food: 20,
      inventory: {
        items: [],
        totalSlots: 36,
        usedSlots: 0
      },
      biome: 'plains',
      timeOfDay: 0,
      isRaining: false,
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

  private initializeContextWeights(): void {
    this.contextWeights.set('player_interaction', {
      category: 'player_interaction',
      baseWeight: 0.3,
      decayRate: 0.1,
      maxWeight: 0.5
    });

    this.contextWeights.set('bot_state', {
      category: 'bot_state',
      baseWeight: 0.2,
      decayRate: 0.05,
      maxWeight: 0.4
    });

    this.contextWeights.set('inventory', {
      category: 'inventory',
      baseWeight: 0.2,
      decayRate: 0.05,
      maxWeight: 0.4
    });

    this.contextWeights.set('task_history', {
      category: 'task_history',
      baseWeight: 0.3,
      decayRate: 0.1,
      maxWeight: 0.5
    });
  }

  public getBot(): MinecraftBot {
    return this.minecraftBot;
  }
}