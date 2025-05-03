import { IMLStateManager } from '@/types/ml/interfaces';
import { EnhancedResourceNeedPredictor } from '../prediction/resource_need_predictor';
import logger from '@/utils/observability/logger';

export class MLTaskOptimizer {
  constructor(
    private stateManager: IMLStateManager,
    private predictor: EnhancedResourceNeedPredictor
  ) {}

  async optimizeResourceGathering(resourceType: string): Promise<{
    quantity: number;
    priority: number;
  }> {
    try {
      const predictedQuantity = await this.predictor.predictResourceNeeds(resourceType);
      const priority = this.calculatePriority(resourceType);

      return {
        quantity: predictedQuantity,
        priority
      };
    } catch (error) {
      logger.error('Failed to optimize resource gathering:', error);
      return {
        quantity: 1,
        priority: 50
      };
    }
  }

  private calculatePriority(resourceType: string): number {
    // Simple priority calculation based on resource type
    const priorityMap: { [key: string]: number } = {
      'wood': 80,
      'stone': 70,
      'iron_ore': 60,
      'coal': 50,
      'diamond': 90
    };

    return priorityMap[resourceType] || 50;
  }
} 