import { Bot } from 'mineflayer';
import { IDataCollector } from '@/types/ml/interfaces';
import logger from '@/utils/observability/logger';

export class TrainingDataCollector implements IDataCollector {
  private isInitialized: boolean = false;
  private isCollecting: boolean = false;
  private trainingData: any[] = [];

  constructor(private bot: Bot) {}

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.setupEventListeners();
      this.isInitialized = true;
      logger.info('TrainingDataCollector initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize TrainingDataCollector', { error });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    this.isCollecting = false;
    this.isInitialized = false;
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
    if (!this.isCollecting) return;

    const prediction = {
      timestamp: Date.now(),
      type,
      input,
      output,
      success,
      confidence,
      latency,
      metadata
    };

    this.trainingData.push(prediction);
  }

  public getTrainingData(type: string): any[] {
    return this.trainingData.filter(data => data.type === type);
  }

  private setupEventListeners(): void {
    this.bot.on('chat', (username: string, message: string) => {
      if (this.isCollecting) {
        this.recordPrediction(
          'chat',
          { username, message },
          { response: null },
          true,
          1.0,
          0
        );
      }
    });
  }
} 