import { Bot as MineflayerBot } from 'mineflayer';
import { IDataCollector } from '@/types/ml/interfaces';

export class TrainingDataCollectorAdapter implements IDataCollector {
  private adaptee: IDataCollector;

  constructor(
    private bot: MineflayerBot,
    adaptee: IDataCollector
  ) {
    this.adaptee = adaptee;
  }

  async initialize(): Promise<void> {
    await this.adaptee.initialize();
  }

  async shutdown(): Promise<void> {
    await this.adaptee.shutdown();
  }

  start(): void {
    this.adaptee.start();
  }

  stop(): void {
    this.adaptee.stop();
  }

  async recordPrediction(
    type: string,
    input: any,
    output: any,
    success: boolean,
    confidence: number,
    latency: number,
    metadata?: any
  ): Promise<void> {
    await this.adaptee.recordPrediction(type, input, output, success, confidence, latency, metadata);
  }

  getTrainingData(type: string): any {
    return this.adaptee.getTrainingData(type);
  }
} 