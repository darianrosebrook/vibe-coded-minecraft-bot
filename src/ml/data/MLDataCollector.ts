import { EnhancedGameState } from '@/types';
import { MLError } from '../error/MLErrorSystem';
import { FeedbackData } from '../feedback/MLFeedbackSystem';
import { MLDataManager } from '../storage/MLDataManager';

export interface InteractionLog {
  timestamp: number;
  command: string;
  response: string;
  success: boolean;
  executionTime: number;
  state: EnhancedGameState;
}

export interface StateChangeLog {
  timestamp: number;
  stateBefore: EnhancedGameState;
  stateAfter: EnhancedGameState;
  changes: {
    position?: boolean;
    health?: boolean;
    inventory?: boolean;
    environment?: boolean;
  };
}

export interface ResourceChangeLog {
  timestamp: number;
  resourceType: string;
  quantity: number;
  change: number;
  location: { x: number; y: number; z: number };
}

export class MLDataCollector {
  private dataManager: MLDataManager;
  private interactionLogs: InteractionLog[] = [];
  private stateChangeLogs: StateChangeLog[] = [];
  private resourceChangeLogs: ResourceChangeLog[] = [];

  constructor(dataManager: MLDataManager) {
    this.dataManager = dataManager;
  }

  public async logInteraction(
    command: string,
    response: string,
    success: boolean,
    executionTime: number,
    state: EnhancedGameState
  ): Promise<void> {
    const log: InteractionLog = {
      timestamp: Date.now(),
      command,
      response,
      success,
      executionTime,
      state
    };

    this.interactionLogs.push(log);
    await this.dataManager.storeData('interactions', log);
    await this.processInteractionData(log);
  }

  public async logStateChange(
    stateBefore: EnhancedGameState,
    stateAfter: EnhancedGameState
  ): Promise<void> {
    const changes = this.detectStateChanges(stateBefore, stateAfter);
    const log: StateChangeLog = {
      timestamp: Date.now(),
      stateBefore,
      stateAfter,
      changes
    };

    this.stateChangeLogs.push(log);
    await this.dataManager.storeData('stateChanges', log);
    await this.processStateChangeData(log);
  }

  public async logResourceChange(
    resourceType: string,
    quantity: number,
    change: number,
    location: { x: number; y: number; z: number }
  ): Promise<void> {
    const log: ResourceChangeLog = {
      timestamp: Date.now(),
      resourceType,
      quantity,
      change,
      location
    };

    this.resourceChangeLogs.push(log);
    await this.dataManager.storeData('resourceChanges', log);
    await this.processResourceData(log);
  }

  private detectStateChanges(
    before: EnhancedGameState,
    after: EnhancedGameState
  ): StateChangeLog['changes'] {
    return {
      position: !before.position.equals(after.position),
      health: before.health !== after.health,
      inventory: this.hasInventoryChanged(before, after),
      environment: this.hasEnvironmentChanged(before, after)
    };
  }

  private hasInventoryChanged(
    before: EnhancedGameState,
    after: EnhancedGameState
  ): boolean {
    const beforeItems = before.inventory.items();
    const afterItems = after.inventory.items();
    
    if (beforeItems.length !== afterItems.length) return true;
    
    return beforeItems.some((item, index) => {
      const afterItem = afterItems[index];
      return item.name !== afterItem.name || item.count !== afterItem.count;
    });
  }

  private hasEnvironmentChanged(
    before: EnhancedGameState,
    after: EnhancedGameState
  ): boolean {
    return (
      before.biome.name !== after.biome.name ||
      before.timeOfDay !== after.timeOfDay ||
      before.isRaining !== after.isRaining ||
      before.environment.lightLevel !== after.environment.lightLevel
    );
  }

  private async processInteractionData(log: InteractionLog): Promise<void> {
    // Extract features for command understanding
    const features = {
      commandLength: log.command.length,
      responseLength: log.response.length,
      executionTime: log.executionTime,
      success: log.success,
      timeOfDay: log.state.timeOfDay,
      biome: log.state.biome.name,
      health: log.state.health,
      food: log.state.food
    };

    await this.dataManager.storeData('interactionFeatures', features);
  }

  private async processStateChangeData(log: StateChangeLog): Promise<void> {
    // Extract features for state prediction
    const features = {
      positionChange: log.changes.position,
      healthChange: log.changes.health,
      inventoryChange: log.changes.inventory,
      environmentChange: log.changes.environment,
      timeOfDay: log.stateAfter.timeOfDay,
      biome: log.stateAfter.biome.name
    };

    await this.dataManager.storeData('stateChangeFeatures', features);
  }

  private async processResourceData(log: ResourceChangeLog): Promise<void> {
    // Extract features for resource prediction
    const features = {
      resourceType: log.resourceType,
      quantity: log.quantity,
      change: log.change,
      location: log.location
    };

    await this.dataManager.storeData('resourceFeatures', features);
  }

  public getInteractionLogs(): InteractionLog[] {
    return this.interactionLogs;
  }

  public getStateChangeLogs(): StateChangeLog[] {
    return this.stateChangeLogs;
  }

  public getResourceChangeLogs(): ResourceChangeLog[] {
    return this.resourceChangeLogs;
  }

  public async clearLogs(): Promise<void> {
    this.interactionLogs = [];
    this.stateChangeLogs = [];
    this.resourceChangeLogs = [];
    await this.dataManager.clearData('interactions');
    await this.dataManager.clearData('stateChanges');
    await this.dataManager.clearData('resourceChanges');
  }
} 