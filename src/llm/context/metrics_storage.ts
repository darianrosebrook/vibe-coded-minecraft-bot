import { PromptMetrics, TemplateVersion } from "./prompt_optimizer";
import fs from "fs";
import path from "path";

interface StoredMetrics {
  metrics: PromptMetrics[];
  templates: Map<string, TemplateVersion[]>;
  lastUpdated: number;
}

export class MetricsStorage {
  private storagePath: string;
  private metrics: StoredMetrics;

  constructor(storagePath: string = 'data/metrics') {
    this.storagePath = storagePath;
    this.metrics = {
      metrics: [],
      templates: new Map(),
      lastUpdated: Date.now()
    };
    this.ensureStorageDirectory();
    this.loadMetrics();
  }

  /**
   * Ensures the storage directory exists
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Loads metrics from storage
   */
  private loadMetrics(): void {
    const metricsFile = path.join(this.storagePath, 'metrics.json');
    if (fs.existsSync(metricsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
        this.metrics = {
          ...data,
          templates: new Map(Object.entries(data.templates))
        };
      } catch (error) {
        console.error('Error loading metrics:', error);
        // Start fresh if loading fails
        this.metrics = {
          metrics: [],
          templates: new Map(),
          lastUpdated: Date.now()
        };
      }
    }
  }

  /**
   * Saves metrics to storage
   */
  private saveMetrics(): void {
    const metricsFile = path.join(this.storagePath, 'metrics.json');
    try {
      const data = {
        ...this.metrics,
        templates: Object.fromEntries(this.metrics.templates)
      };
      fs.writeFileSync(metricsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  /**
   * Stores a single metric
   */
  async storeMetric(metric: PromptMetrics): Promise<void> {
    this.metrics.metrics.push(metric);
    this.metrics.lastUpdated = Date.now();
    this.saveMetrics();
  }

  /**
   * Stores template versions
   */
  async storeTemplateVersions(templateId: string, versions: TemplateVersion[]): Promise<void> {
    this.metrics.templates.set(templateId, versions);
    this.metrics.lastUpdated = Date.now();
    this.saveMetrics();
  }

  /**
   * Gets all metrics for a template
   */
  async getTemplateMetrics(templateId: string): Promise<PromptMetrics[]> {
    return this.metrics.metrics.filter(m => m.promptId === templateId);
  }

  /**
   * Gets all template versions
   */
  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return this.metrics.templates.get(templateId) || [];
  }

  /**
   * Gets all metrics
   */
  async getAllMetrics(): Promise<PromptMetrics[]> {
    return this.metrics.metrics;
  }

  /**
   * Cleans up old metrics
   */
  async cleanupMetrics(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    this.metrics.metrics = this.metrics.metrics.filter(m => m.timestamp >= cutoff);
    this.saveMetrics();
  }
} 