import { EnhancedGameState } from '@/types';
import { MLError } from '../error/MLErrorSystem';
import { FeedbackData } from '../feedback/MLFeedbackSystem';
import { InteractionLog, StateChangeLog, ResourceChangeLog } from '../data/MLDataCollector';

export interface DataVersion {
  version: number;
  timestamp: number;
  description: string;
  dataType: string;
}

export class MLDataManager {
  private dataVersions: Map<string, DataVersion[]> = new Map();
  private currentVersion: Map<string, number> = new Map();
  private dataStore: Map<string, any[]> = new Map();

  constructor() {
    // Initialize data manager
  }

  public async storeData(type: string, data: any): Promise<void> {
    const version = this.getNextVersion(type);
    const dataVersion: DataVersion = {
      version,
      timestamp: Date.now(),
      description: `Version ${version} of ${type}`,
      dataType: type
    };

    const versions = this.dataVersions.get(type) || [];
    versions.push(dataVersion);
    this.dataVersions.set(type, versions);
    this.currentVersion.set(type, version);

    // Store the actual data
    const dataArray = this.dataStore.get(type) || [];
    dataArray.push(data);
    this.dataStore.set(type, dataArray);
  }

  public async storeGameState(state: EnhancedGameState): Promise<void> {
    await this.storeData('gameState', state);
  }

  public async storeError(error: MLError): Promise<void> {
    await this.storeData('errors', error);
  }

  public async storeFeedback(feedback: FeedbackData): Promise<void> {
    await this.storeData('feedback', feedback);
  }

  private getNextVersion(type: string): number {
    return (this.currentVersion.get(type) || 0) + 1;
  }

  public async getData(type: string, version?: number): Promise<any> {
    if (!version) {
      version = this.currentVersion.get(type);
    }
    const dataArray = this.dataStore.get(type) || [];
    return dataArray[version! - 1] || null;
  }

  public async getAllData(type: string): Promise<any[]> {
    return this.dataStore.get(type) || [];
  }

  public async rollback(type: string, version: number): Promise<boolean> {
    try {
      const dataArray = this.dataStore.get(type) || [];
      if (version > dataArray.length) {
        throw new Error(`Version ${version} does not exist for type ${type}`);
      }
      
      this.currentVersion.set(type, version);
      return true;
    } catch (error) {
      console.error(`Failed to rollback ${type} to version ${version}:`, error);
      return false;
    }
  }

  public getVersionHistory(type: string): DataVersion[] {
    return this.dataVersions.get(type) || [];
  }

  public async clearData(type: string): Promise<void> {
    this.dataStore.delete(type);
    this.dataVersions.delete(type);
    this.currentVersion.delete(type);
  }

  public async getInteractionLogs(): Promise<InteractionLog[]> {
    return this.getAllData('interactions');
  }

  public async getStateChangeLogs(): Promise<StateChangeLog[]> {
    return this.getAllData('stateChanges');
  }

  public async getResourceChangeLogs(): Promise<ResourceChangeLog[]> {
    return this.getAllData('resourceChanges');
  }

  public async getFeatures(type: string): Promise<any[]> {
    return this.getAllData(`${type}Features`);
  }
} 