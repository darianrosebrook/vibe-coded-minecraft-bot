import logger from '@/utils/observability/logger';
import { ITrainingDataStorage } from '@/types/ml/interfaces';
import { promises as fs } from 'fs';
import path from 'path';
import { Stats } from 'fs';

interface FileStats {
  file: string;
  stats: Stats;
}

export class MLDataManager implements ITrainingDataStorage {
  private dataPath: string;
  private isInitialized: boolean = false;
  private writeQueue: Promise<void> = Promise.resolve();
  private lock: boolean = false;

  constructor(dataPath: string) {
    this.dataPath = path.resolve(dataPath);
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.ensureDataDirectory();
      this.isInitialized = true;
      logger.info('MLDataManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MLDataManager', { error });
      throw error;
    }
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory', { error, path: this.dataPath });
      throw error;
    }
  }

  private async acquireLock(): Promise<void> {
    while (this.lock) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.lock = true;
  }

  private releaseLock(): void {
    this.lock = false;
  }

  public async storeTrainingData(type: string, data: any, version: number): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MLDataManager not initialized');
    }

    try {
      await this.acquireLock();
      this.writeQueue = this.writeQueue.then(async () => {
        try {
          const filePath = path.join(this.dataPath, `${type}_v${version}.json`);
          await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
          logger.error(`Failed to store ${type} data`, { error, data });
          throw error;
        }
      });
    } finally {
      this.releaseLock();
    }
  }

  public async getTrainingData(type: string, version?: number): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('MLDataManager not initialized');
    }

    try {
      if (version) {
        const filePath = path.join(this.dataPath, `${type}_v${version}.json`);
        const fileData = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileData);
      } else {
        // Get latest version
        const files = await fs.readdir(this.dataPath);
        const typeFiles = files.filter(f => f.startsWith(`${type}_v`));
        if (typeFiles.length === 0) return null;
        
        const latestFile = typeFiles.sort().pop()!;
        const filePath = path.join(this.dataPath, latestFile);
        const fileData = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileData);
      }
    } catch (error) {
      logger.error(`Failed to get ${type} data`, { error });
      return null;
    }
  }

  public async cleanup(maxSize: number): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MLDataManager not initialized');
    }

    try {
      await this.acquireLock();
      const files = await fs.readdir(this.dataPath);
      
      // Sort files by modification time
      const fileStats: FileStats[] = await Promise.all(
        files.map(async file => {
          const stats = await fs.stat(path.join(this.dataPath, file));
          return { file, stats };
        })
      );
      
      fileStats.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
      
      // Remove oldest files if total size exceeds maxSize
      let totalSize = 0;
      for (const { file, stats } of fileStats) {
        totalSize += stats.size;
        if (totalSize > maxSize) {
          await fs.unlink(path.join(this.dataPath, file));
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup data', { error });
      throw error;
    } finally {
      this.releaseLock();
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await this.writeQueue;
      this.isInitialized = false;
    } catch (error) {
      logger.error('Failed to shutdown MLDataManager', { error });
      throw error;
    }
  }
} 