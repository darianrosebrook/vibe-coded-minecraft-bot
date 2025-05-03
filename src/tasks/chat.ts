import { BaseTask, TaskOptions } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, TaskParameters, ChatTaskParameters, TaskResult, TaskType, TaskStatus } from '@/types/task';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Bot as MineflayerBot } from 'mineflayer';
import { CentralizedDataCollector } from '../ml/state/centralized_data_collector';
import { TaskStorage } from '../storage/taskStorage';
import { TrainingDataStorage } from '../ml/state/training_data_storage';

interface ChatMLState {
  chatState: {
    messageCount: number;
    uniqueSenders: number;
    efficiency: number;
  };
  message: {
    content: string;
    chatType: string
    success: boolean;
    timeTaken: number;
  };
}

export class ChatTask extends BaseTask {
  protected override readonly bot: MinecraftBot;
  protected override readonly commandHandler: CommandHandler;
  protected override readonly options: ChatTaskParameters;
  protected override mineflayerBot: MineflayerBot;
  protected override stopRequested: boolean = false;
  protected messages: Array<{ sender: string; content: string; timestamp: number }> = [];
  protected override dataCollector: CentralizedDataCollector;
  protected override storage: TaskStorage;
  protected override trainingStorage: TrainingDataStorage;
  protected override startTime: number = 0;
  protected mlState: ChatMLState | null = null;
  protected retryDelay: number;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: ChatTaskParameters) {
    super(bot, commandHandler, {
      ...options,
      useML: options.useML ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      timeout: options.timeout ?? 70000
    });
    this.bot = bot;
    this.commandHandler = commandHandler;
    this.mineflayerBot = bot.getMineflayerBot();
    this.options = options;
    this.retryDelay = options.retryDelay ?? 5000;
    // Initialize data collection
    this.dataCollector = new CentralizedDataCollector(this.mineflayerBot);
    this.storage = new TaskStorage('./data');
    this.trainingStorage = new TrainingDataStorage();
    this.dataCollector.start();
  }

  protected async getTaskSpecificState(): Promise<ChatMLState> {
    return {
      chatState: {
        messageCount: this.messages.length,
        uniqueSenders: new Set(this.messages.map(m => m.sender)).size,
        efficiency: this.calculateChatEfficiency()
      },
      message: {
        content: this.options.message,
        chatType: this.options.chatType,
        success: true,
        timeTaken: Date.now() - this.startTime
      }
    };
  }

  private calculateChatEfficiency(): number {
    if (this.startTime === 0) return 0;
    const timeElapsed = Date.now() - this.startTime;
    return this.messages.length / (timeElapsed / 1000);
  }

  private async sendMessage(): Promise<boolean> {
    try {
      await this.mineflayerBot.chat(this.options.message);
      return true;
    } catch (error) {
      logger.error('Failed to send message', { error });
      return false;
    }
  }

  public override async validateTask(): Promise<void> {
    await super.validateTask();

    if (!this.options.message) {
      throw new Error('Message is required');
    }

    if (!this.options.chatType) {
      throw new Error('Chat type is required');
    }
  }

  public override async initializeProgress(): Promise<void> {
    await super.initializeProgress();
    this.messages = [];
  }

  public override async performTask(): Promise<void> {
    await this.initializeMLState();

    const success = await this.sendMessage();
    if (!success) {
      this.retryCount++;
      if (this.retryCount > this.maxRetries) {
        throw new Error('Failed to send message after multiple attempts');
      }
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      return this.performTask();
    }

    await this.updateProgress(100);
  }

  public override stop(): void {
    this.stopRequested = true;
  }
} 