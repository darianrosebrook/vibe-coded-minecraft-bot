import { CommandPattern } from '@/types/ml/command';
import { createCommandPattern } from './pattern_helpers';
import fs from 'fs';
import path from 'path';
import logger from '../../utils/observability/logger';

/**
 * Store for managing command patterns
 */
export class PatternStore {
  private patterns: CommandPattern[] = [];
  private storePath: string;
  private initialized: boolean = false;
  
  constructor(storePath: string = 'data/command_patterns.json') {
    this.storePath = storePath;
    try {
      this.loadPatterns();
      
      // Initialize with some default patterns if none exist
      if (this.patterns.length === 0) {
        this.initializeDefaultPatterns();
      }
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize pattern store', { error });
      this.initialized = false;
    }
  }
  
  /**
   * Get all patterns, initializing with defaults if needed
   */
  getPatterns(): CommandPattern[] {
    if (!this.initialized) {
      try {
        this.initializeDefaultPatterns();
        this.initialized = true;
      } catch (error) {
        logger.error('Failed to initialize default patterns', { error });
        return [];
      }
    }
    return [...this.patterns];
  }
  
  /**
   * Add a new pattern to the store
   */
  addPattern(pattern: CommandPattern): void {
    try {
      // Don't add duplicates
      if (this.patterns.some(p => p.pattern === pattern.pattern)) {
        return;
      }
      this.patterns.push(pattern);
      this.savePatterns();
    } catch (error) {
      logger.error('Failed to add pattern', { error, pattern });
    }
  }

  /**
   * Update an existing pattern in the store
   */
  updatePattern(pattern: CommandPattern): void {
    try {
      const index = this.patterns.findIndex(p => p.pattern === pattern.pattern);
      if (index !== -1) {
        this.patterns[index] = pattern;
        this.savePatterns();
      }
    } catch (error) {
      logger.error('Failed to update pattern', { error, pattern });
    }
  }
  
  /**
   * Remove a pattern from the store
   */
  removePattern(pattern: CommandPattern): void {
    try {
      const index = this.patterns.findIndex(p => p.pattern === pattern.pattern);
      if (index !== -1) {
        this.patterns.splice(index, 1);
        this.savePatterns();
      }
    } catch (error) {
      logger.error('Failed to remove pattern', { error, pattern });
    }
  }
  
  /**
   * Clear all patterns from the store
   */
  clearPatterns(): void {
    try {
      this.patterns = [];
      this.savePatterns();
    } catch (error) {
      logger.error('Failed to clear patterns', { error });
    }
  }
  
  /**
   * Save patterns to disk
   */
  private savePatterns(): void {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2));
    } catch (error) {
      logger.error('Failed to save patterns', { error, storePath: this.storePath });
    }
  }
  
  /**
   * Load patterns from disk
   */
  private loadPatterns(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf8');
        this.patterns = JSON.parse(data);
      }
    } catch (error) {
      logger.error('Failed to load patterns', { error, storePath: this.storePath });
      this.patterns = [];
    }
  }
  
  /**
   * Initialize with default patterns
   */
  private initializeDefaultPatterns(): void {
    try {
      const defaultPatterns: CommandPattern[] = [
        createCommandPattern('mine {block}', 'mining', { block: 'string' }),
        createCommandPattern('craft {item}', 'crafting', { item: 'string' }),
        createCommandPattern('build {structure}', 'building', { structure: 'string' }),
        createCommandPattern('explore {direction}', 'exploration', { direction: 'string' }),
        createCommandPattern('fight {mob}', 'combat', { mob: 'string' })
      ];
      
      this.patterns = defaultPatterns;
      this.savePatterns();
    } catch (error) {
      logger.error('Failed to initialize default patterns', { error });
      throw error;
    }
  }
}

// Export a singleton instance
export const patternStore = new PatternStore(); 