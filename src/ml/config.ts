import { z } from 'zod';

export const MLConfigSchema = z.object({
  enabled: z.boolean().default(true),
  dataCollection: z.object({
    enabled: z.boolean().default(true),
    storagePath: z.string().default('./data/ml'),
    maxStorageSize: z.number().default(1000),
    cleanupInterval: z.number().default(3600000), // 1 hour
    dataPath: z.string().default('./data/ml'),
    dataRetentionPeriod: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
    maxDataSize: z.number().default(1024 * 1024 * 1024), // 1GB
  }),
  training: z.object({
    enabled: z.boolean().default(true),
    batchSize: z.number().default(32),
    epochs: z.number().default(10),
    learningRate: z.number().default(0.001),
    validationSplit: z.number().default(0.2),
    modelPath: z.string().optional(),
  }),
  optimization: z.object({
    enabled: z.boolean().default(true),
    updateInterval: z.number().default(1000),
    maxHistorySize: z.number().default(1000),
  }),
  feedback: z.object({
    enabled: z.boolean().default(true),
    collectionInterval: z.number().default(5000),
    maxFeedbackHistory: z.number().default(100),
  }),
});

export type MLConfig = z.infer<typeof MLConfigSchema>;

export const DEFAULT_ML_CONFIG: MLConfig = {
  enabled: true,
  dataCollection: {
    enabled: true,
    storagePath: './data/ml',
    maxStorageSize: 1000,
    cleanupInterval: 3600000,
    dataPath: './data/ml',
    dataRetentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxDataSize: 1024 * 1024 * 1024, // 1GB
  },
  training: {
    enabled: true,
    batchSize: 32,
    epochs: 10,
    learningRate: 0.001,
    validationSplit: 0.2,
  },
  optimization: {
    enabled: true,
    updateInterval: 1000,
    maxHistorySize: 1000,
  },
  feedback: {
    enabled: true,
    collectionInterval: 5000,
    maxFeedbackHistory: 100,
  },
}; 