import { Task } from '../../../types/task';
import { Logger } from '../../../utils/observability/logger';
import { TaskContext } from '../types';


export class TaskParsingLogger {
  private chains: Map<string, LogChain> = new Map();

  constructor(private readonly baseLogger?: Logger) {}

  public startChain(command: string): string {
    const chainId = `chain-${Date.now()}`;
    this.chains.set(chainId, {
      chainId,
      startTime: Date.now(),
      entries: [],
      status: 'in_progress'
    });
    this.logInput(chainId, command);
    return chainId;
  }

  public logContext(chainId: string, context: TaskContext) {
    this.addEntry(chainId, {
      component: 'context',
      level: 'info',
      event: 'context_retrieved',
      data: { context }
    });
  }

  public logPrompt(chainId: string, prompt: string) {
    this.addEntry(chainId, {
      component: 'llm',
      level: 'debug',
      event: 'prompt_generated',
      data: { prompt }
    });
  }

  public logResponse(chainId: string, response: string) {
    this.addEntry(chainId, {
      component: 'llm',
      level: 'info',
      event: 'response_received',
      data: { response }
    });
  }

  public logTask(chainId: string, task: Task) {
    this.addEntry(chainId, {
      component: 'task',
      level: 'info',
      event: 'task_parsed',
      data: { task }
    });
  }

  public logResolution(chainId: string, task: Task) {
    this.addEntry(chainId, {
      component: 'task',
      level: 'info',
      event: 'task_resolved',
      data: { task }
    });
  }

  public logValidationErrors(chainId: string, errors: string[]) {
    this.addEntry(chainId, {
      component: 'validation',
      level: 'error',
      event: 'validation_failed',
      data: { errors }
    });
  }

  public logError(chainId: string, error: Error) {
    this.addEntry(chainId, {
      component: 'error',
      level: 'error',
      event: 'error_occurred',
      data: { error: error.message }
    });
  }

  public endChain(chainId: string, status: 'completed' | 'failed', error?: string) {
    const chain = this.chains.get(chainId);
    if (chain) {
      chain.endTime = Date.now();
      chain.status = status;
      if (error) {
        chain.error = error;
      }
      this.generateSummary(chain);
    }
  }

  public logTypeOverride(originalType: string, newType: string) {
    this.baseLogger?.info('Type override', { originalType, newType });
  }

  public logTypeFallback(originalType: string, fallbackType: string) {
    this.baseLogger?.info('Type fallback', { originalType, fallbackType });
  }

  public logTypeValidationFailure(type: string, subType: string, errors: string[]) {
    this.baseLogger?.error('Type validation failure', { type, subType, errors });
  }

  public logSubTypeValidationFailure(type: string, subType: string, errors: string[]) {
    this.baseLogger?.error('Subtype validation failure', { type, subType, errors });
  }

  private logInput(chainId: string, command: string) {
    this.addEntry(chainId, {
      component: 'input',
      level: 'info',
      event: 'command_received',
      data: { command }
    });
  }

  private addEntry(chainId: string, entry: Omit<LogEntry, 'timestamp' | 'sequenceId'>) {
    const chain = this.chains.get(chainId);
    if (chain) {
      const logEntry: LogEntry = {
        ...entry,
        timestamp: Date.now(),
        sequenceId: `seq-${chain.entries.length + 1}`
      };
      chain.entries.push(logEntry);
      this.baseLogger?.[entry.level](entry.event, entry.data);
    }
  }

  private generateSummary(chain: LogChain) {
    const duration = chain.endTime! - chain.startTime;
    const errors = chain.entries.filter(e => e.level === 'error');
    const warnings = chain.entries.filter(e => e.level === 'warn');

    chain.summary = {
      duration,
      errorCount: errors.length,
      warningCount: warnings.length,
      success: chain.status === 'completed'
    };
  }
}

interface LogEntry {
  timestamp: number;
  sequenceId: string;
  component: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  data: Record<string, any>;
}

interface LogChain {
  chainId: string;
  startTime: number;
  endTime?: number;
  entries: LogEntry[];
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
  summary?: {
    duration: number;
    errorCount: number;
    warningCount: number;
    success: boolean;
  };
} 