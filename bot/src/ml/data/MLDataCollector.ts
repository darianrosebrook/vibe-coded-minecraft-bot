import { Bot } from 'mineflayer';
import logger from '@/utils/observability/logger';
import { IDataCollector } from '@/types/ml/interfaces';
import { TaskContext } from '@/ml/types';

interface Prediction {
  timestamp: number;
  type: string;
  input: any;
  output: any;
  success: boolean;
  confidence: number;
  latency: number;
  metadata?: any;
}

export class MLDataCollector implements IDataCollector {
  private isInitialized: boolean = false;
  private isCollecting: boolean = false;
  private predictions: Map<string, Prediction[]> = new Map();

  constructor(private bot: Bot) {}

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.setupEventListeners();
      this.isInitialized = true;
      logger.info('MLDataCollector initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MLDataCollector', { error });
      throw error;
    }
  }

  private setupEventListeners(): void {
    try {
      this.bot.on('chat', (username: string, message: string) => {
        if (this.isCollecting) {
          this.recordPrediction(
            'chat',
            { username, message },
            { response: null },
            true,
            1.0,
            Date.now()
          );
        }
      });

      this.bot.on('error', (error: Error) => {
        if (this.isCollecting) {
          this.recordPrediction(
            'error',
            { error: error.message },
            { handled: false },
            false,
            0.0,
            Date.now()
          );
        }
      });
    } catch (error) {
      logger.error('Failed to setup event listeners', { error });
      throw error;
    }
  }

  public start(): void {
    this.isCollecting = true;
  }

  public stop(): void {
    this.isCollecting = false;
  }

  public async recordPrediction(
    type: string,
    input: any,
    output: any,
    success: boolean,
    confidence: number,
    latency: number,
    metadata?: any
  ): Promise<void> {
    try {
      const prediction: Prediction = {
        timestamp: Date.now(),
        type,
        input,
        output,
        success,
        confidence,
        latency,
        metadata
      };

      const predictions = this.predictions.get(type) || [];
      predictions.push(prediction);
      this.predictions.set(type, predictions);
    } catch (error) {
      logger.error('Failed to record prediction', { error, type });
    }
  }

  public getTrainingData(type: string): Prediction[] {
    return this.predictions.get(type) || [];
  }

  public async shutdown(): Promise<void> {
    try {
      this.isCollecting = false;
      this.isInitialized = false;
      this.predictions.clear();
    } catch (error) {
      logger.error('Failed to shutdown MLDataCollector', { error });
      throw error;
    }
  }
} 