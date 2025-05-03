import { Bot } from 'mineflayer';
import { CentralizedDataCollector } from './centralized_data_collector';
import { TrainingDataCollector } from './training_data_collector';

/**
 * Adapter class to make CentralizedDataCollector usable as TrainingDataCollector
 */
export class TrainingDataCollectorAdapter extends TrainingDataCollector {
  private centralizedCollector: CentralizedDataCollector;

  constructor(bot: Bot, centralizedCollector: CentralizedDataCollector) {
    super(bot);
    this.centralizedCollector = centralizedCollector;
  }

  public override async recordPrediction(
    predictionType: string,
    input: any,
    output: any,
    success: boolean,
    confidence: number,
    executionTime: number
  ) {
    // Delegate to the centralized collector
    await this.centralizedCollector.recordPrediction(
      predictionType,
      input,
      output,
      success,
      confidence,
      executionTime
    );
  }

  public override getTrainingData(predictionType: string) { 
    return this.centralizedCollector.getTrainingData(predictionType);
  }

  public override clearData(predictionType?: string) {
    this.centralizedCollector.clearData(predictionType);
  }
} 