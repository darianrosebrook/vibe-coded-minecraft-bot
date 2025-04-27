import { Task } from '../../types/task';
import { TaskParsingLogger } from '../logging/logger';

interface CacheEntry {
  task: Task;
  timestamp: number;
  hitCount: number;
  lastAccess: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  averageResponseTime: number;
  totalCommands: number;
}

export class CommandCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds
  private metrics: CacheMetrics;
  private logger: TaskParsingLogger;

  constructor(maxSize: number = 1000, ttl: number = 3600000) { // Default 1 hour TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      averageResponseTime: 0,
      totalCommands: 0
    };
    this.logger = new TaskParsingLogger();
  }

  public get(command: string): Task | null {
    const startTime = Date.now();
    const entry = this.cache.get(command);

    if (!entry) {
      this.metrics.misses++;
      this.metrics.totalCommands++;
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(command);
      this.metrics.evictions++;
      this.metrics.misses++;
      this.metrics.totalCommands++;
      return null;
    }

    // Update entry stats
    entry.lastAccess = Date.now();
    entry.hitCount++;
    this.cache.set(command, entry);

    // Update metrics
    this.metrics.hits++;
    this.metrics.totalCommands++;
    const responseTime = Date.now() - startTime;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalCommands - 1) + responseTime) / 
      this.metrics.totalCommands;

    return entry.task;
  }

  public set(command: string, task: Task): void {
    const startTime = Date.now();

    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      task,
      timestamp: Date.now(),
      hitCount: 0,
      lastAccess: Date.now()
    };

    this.cache.set(command, entry);

    // Log cache operation
    this.logger.logTaskResolution(entry.task);
  }

  private evictOldest(): void {
    let oldestEntry: { key: string; lastAccess: number } | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldestEntry || entry.lastAccess < oldestEntry.lastAccess) {
        oldestEntry = { key, lastAccess: entry.lastAccess };
      }
    }

    if (oldestEntry) {
      this.cache.delete(oldestEntry.key);
      this.metrics.evictions++;
    }
  }

  public clear(): void {
    this.cache.clear();
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      averageResponseTime: 0,
      totalCommands: 0
    };
  }

  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  public getCacheSize(): number {
    return this.cache.size;
  }

  public getHitRate(): number {
    if (this.metrics.totalCommands === 0) return 0;
    return this.metrics.hits / this.metrics.totalCommands;
  }
} 