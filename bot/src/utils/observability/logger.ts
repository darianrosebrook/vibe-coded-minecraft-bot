import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";

const { combine, timestamp, json, errors, printf } = winston.format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Create the logs directory if it doesn't exist
const logDir = process.env.LOG_DIR || "logs";
const logFile = path.join(logDir, "bot.log");

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level}]: ${message} ${metaString}`;
});

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

// Create a Winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "debug", // Set to debug for testing
  levels,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { 
    service: "minecraft-bot",
    environment: process.env.NODE_ENV || "development"
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        consoleFormat
      ),
    }),
    // File transport with rotation
    new winston.transports.DailyRotateFile({
      filename: logFile,
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        errors({ stack: true }),
        json()
      )
    }),
  ],
});

// Add request ID tracking
let requestId = 0;
export const getNextRequestId = () => ++requestId;

// Add command tracking
export const logCommand = (command: string, username: string, meta?: any) => {
  const id = getNextRequestId();
  logger.info('Command received', {
    requestId: id,
    command,
    username,
    timestamp: new Date().toISOString(),
    ...meta
  });
  return id;
};

// Add task tracking
export const logTask = (taskId: string, taskType: string, parameters: any, meta?: any) => {
  logger.info('Task execution', {
    taskId,
    taskType,
    parameters,
    timestamp: new Date().toISOString(),
    ...meta
  });
};

// Add error tracking
export const logError = (error: Error, context: any = {}) => {
  logger.error('Error occurred', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context,
    timestamp: new Date().toISOString()
  });
};

export default logger;

export class Logger implements Logger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "debug",
      levels,
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        errors({ stack: true }),
        json()
      ),
      defaultMeta: { 
        service: "minecraft-bot",
        environment: process.env.NODE_ENV || "development"
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            consoleFormat
          )
        })
      ]
    });
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }
}
