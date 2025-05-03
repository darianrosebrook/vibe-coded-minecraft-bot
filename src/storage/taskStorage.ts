import { TaskProgress, TaskResult as TaskResultType } from '@/types/task';
import logger from '@/utils/observability/logger';
import { Logger } from '@/utils/observability/logger';
import fs from 'fs';
import path from 'path';

export interface StorageConfig {
  maxAge: number; // Maximum age of progress files in milliseconds
  maxCompletedAge: number; // Maximum age of completed task results in milliseconds
  cleanupInterval: number; // How often to run cleanup in milliseconds
  maxProgressHistory: number; // Maximum number of progress history entries to keep
}

export type TaskResult = TaskResultType;

export class TaskStorage {
  private storagePath: string;
  private progressFile: string;
  private resultsFile: string;
  private config: StorageConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private logger?: Logger;

  constructor(storagePath: string = './data', config: Partial<StorageConfig> = {}, logger?: Logger) {
    this.storagePath = storagePath;
    this.progressFile = path.join(storagePath, 'task_progress.json');
    this.resultsFile = path.join(storagePath, 'task_results.json');

    // Default configuration
    this.config = {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxCompletedAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxProgressHistory: 1000,
      ...config
    };
    if (logger) {
      this.logger = logger;
    }
    this.ensureStorageExists();
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), this.config.cleanupInterval);
  }

  public async cleanup(): Promise<void> {
    console.log('Starting storage cleanup...');
    const now = Date.now();

    // Clean up progress files
    const progressData = await this.readProgressFile();
    let cleanedProgress = 0;
    for (const [taskId, progress] of Object.entries(progressData)) {
      if (this.shouldCleanupProgress(progress, now)) {
        delete progressData[taskId];
        cleanedProgress++;
      } else {
        // Trim progress history if needed
        if (progress.progressHistory && progress.progressHistory.length > this.config.maxProgressHistory) {
          progress.progressHistory = progress.progressHistory.slice(-this.config.maxProgressHistory);
        }
      }
    }
    await this.writeProgressFile(progressData);

    // Clean up results files
    const resultsData = await this.readResultsFile();
    let cleanedResults = 0;
    for (const [taskId, result] of Object.entries(resultsData)) {
      if (this.shouldCleanupResult(result, now)) {
        delete resultsData[taskId];
        cleanedResults++;
      }
    }
    await this.writeResultsFile(resultsData);

    console.log(`Cleanup completed: Removed ${cleanedProgress} progress entries and ${cleanedResults} result entries`);
  }

  private shouldCleanupProgress(progress: TaskProgress, now: number): boolean {
    // Clean up if task is too old
    if (now - (progress.created || 0) > this.config.maxAge) {
      return true;
    }

    // Clean up if task is completed and older than maxCompletedAge
    if (progress.status === 'completed' && now - (progress.lastUpdated || 0) > this.config.maxCompletedAge) {
      return true;
    }

    // Clean up if task is failed and older than maxAge
    if (progress.status === 'failed' && now - (progress.lastUpdated || 0) > this.config.maxAge) {
      return true;
    }

    return false;
  }

  private shouldCleanupResult(result: TaskResult, now: number): boolean {
    if (!result || !result.duration) {
      return true;
    }
    return now - result.duration > this.config.maxCompletedAge;
  }

  private ensureStorageExists(): void {
    if (!this.storagePath) {
      throw new Error('Storage path is not defined');
    }

    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    if (!fs.existsSync(this.progressFile)) {
      fs.writeFileSync(this.progressFile, JSON.stringify({}));
    }
    if (!fs.existsSync(this.resultsFile)) {
      fs.writeFileSync(this.resultsFile, JSON.stringify({}));
    }
  }

  public async saveProgress(taskId: string, progress: TaskProgress): Promise<void> {
    const data = await this.readProgressFile();
    data[taskId] = {
      ...progress,
      lastUpdated: Date.now(),
      created: progress.created || Date.now()
    };
    await this.writeProgressFile(data);
  }

  public async getProgress(taskId: string): Promise<TaskProgress | null> {
    const data = await this.readProgressFile();
    return data[taskId] || null;
  }

  public async getAllProgress(): Promise<Record<string, TaskProgress>> {
    return await this.readProgressFile();
  }

  public async saveResult(taskId: string, result: TaskResult): Promise<void> {
    const results = await this.readResultsFile();
    results[taskId] = result;
    await this.writeResultsFile(results);
  }

  public async getResult(taskId: string): Promise<TaskResult | null> {
    const data = await this.readResultsFile();
    return data[taskId] || null;
  }

  public async getAllResults(): Promise<Record<string, TaskResult>> {
    return await this.readResultsFile();
  }

  public async clearProgress(taskId: string): Promise<void> {
    const data = await this.readProgressFile();
    delete data[taskId];
    await this.writeProgressFile(data);
  }

  public async clearResults(taskId: string): Promise<void> {
    const data = await this.readResultsFile();
    delete data[taskId];
    await this.writeResultsFile(data);
  }

  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private async readProgressFile(): Promise<Record<string, TaskProgress>> {
    try {
      if (!fs.existsSync(this.progressFile)) {
        return {};
      }
      const data = await fs.promises.readFile(this.progressFile, 'utf-8');
      return JSON.parse(data) as Record<string, TaskProgress>;
    } catch (error) {
      this.logger?.error('Failed to read progress file', error);
      return {};
    }
  }

  private async writeProgressFile(data: Record<string, TaskProgress>): Promise<void> {
    try {
      await fs.promises.writeFile(this.progressFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing progress file:', error);
    }
  }

  private async readResultsFile(): Promise<Record<string, TaskResult>> {
    try {
      const data = await fs.promises.readFile(this.resultsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading results file:', error);
      return {};
    }
  }

  private async writeResultsFile(data: Record<string, TaskResult>): Promise<void> {
    try {
      await fs.promises.writeFile(this.resultsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing results file:', error);
    }
  }
} 