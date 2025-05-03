import { Server, Socket } from 'socket.io';
import { MLModelTrainer } from '@ml/reinforcement/model_trainer';
import { MLDataCollector } from '@ml/reinforcement/data_collector';
import { MiningTrainingEnvironment } from '@ml/reinforcement/training';

interface ModelConfig {
  learningRate: number;
  batchSize: number;
  layers: number[];
  optimizer: string;
  lossFunction: string;
}

interface TrainingDataStats {
  totalSamples: number;
  actionDistribution: { action: string; count: number }[];
  averageReward: number;
  successRate: number;
}

export function setupMLSocketHandlers(io: Server, socket: Socket) {
  const modelTrainer = MLModelTrainer.getInstance();
  const dataCollector = MLDataCollector.getInstance();
  const trainingEnv = new MiningTrainingEnvironment();

  // Send initial training metrics
  socket.emit('ml:metrics', {
    type: 'training',
    data: {
      currentEpoch: modelTrainer.getCurrentEpoch(),
      totalEpochs: modelTrainer.getTotalEpochs(),
      accuracy: modelTrainer.getModelAccuracy(),
      metrics: modelTrainer.getTrainingMetrics()
    }
  });

  // Send initial resource usage
  socket.emit('ml:metrics', {
    type: 'resources',
    data: {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      network: 0 // TODO: Implement network usage tracking
    }
  });

  // Send initial command metrics
  socket.emit('ml:metrics', {
    type: 'commands',
    data: dataCollector.getCommandMetrics()
  });

  // Send initial model configuration
  socket.emit('ml:metrics', {
    type: 'config',
    data: {
      learningRate: modelTrainer.getLearningRate(),
      batchSize: modelTrainer.getBatchSize(),
      layers: modelTrainer.getNetworkLayers(),
      optimizer: modelTrainer.getOptimizer(),
      lossFunction: modelTrainer.getLossFunction()
    } as ModelConfig
  });

  // Send initial training statistics
  socket.emit('ml:metrics', {
    type: 'stats',
    data: {
      totalSamples: dataCollector.getTotalSamples(),
      actionDistribution: dataCollector.getActionDistribution(),
      averageReward: dataCollector.getAverageReward(),
      successRate: dataCollector.getSuccessRate()
    } as TrainingDataStats
  });

  // Set up periodic updates
  const metricsInterval = setInterval(() => {
    // Training metrics
    socket.emit('ml:metrics', {
      type: 'training',
      data: {
        currentEpoch: modelTrainer.getCurrentEpoch(),
        totalEpochs: modelTrainer.getTotalEpochs(),
        accuracy: modelTrainer.getModelAccuracy(),
        metrics: modelTrainer.getTrainingMetrics()
      }
    });

    // Resource usage
    socket.emit('ml:metrics', {
      type: 'resources',
      data: {
        timestamp: Date.now(),
        cpu: process.cpuUsage(),
        memory: process.memoryUsage(),
        network: 0 // TODO: Implement network usage tracking
      }
    });

    // Command metrics
    socket.emit('ml:metrics', {
      type: 'commands',
      data: dataCollector.getCommandMetrics()
    });

    // Training statistics
    socket.emit('ml:metrics', {
      type: 'stats',
      data: {
        totalSamples: dataCollector.getTotalSamples(),
        actionDistribution: dataCollector.getActionDistribution(),
        averageReward: dataCollector.getAverageReward(),
        successRate: dataCollector.getSuccessRate()
      } as TrainingDataStats
    });
  }, 1000);

  // Handle socket disconnection
  socket.on('disconnect', () => {
    clearInterval(metricsInterval);
  });

  // Handle training control commands
  socket.on('ml:train', async (data: { epochs: number; batchSize: number }) => {
    try {
      const { epochs, batchSize } = data;
      await modelTrainer.train(epochs, batchSize);
      socket.emit('ml:train:complete', { success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      socket.emit('ml:train:error', { error: errorMessage });
    }
  });

  socket.on('ml:pause', () => {
    modelTrainer.pauseTraining();
    socket.emit('ml:paused', { success: true });
  });

  socket.on('ml:resume', () => {
    modelTrainer.resumeTraining();
    socket.emit('ml:resumed', { success: true });
  });

  socket.on('ml:reset', () => {
    modelTrainer.resetModel();
    socket.emit('ml:reset:complete', { success: true });
  });
} 