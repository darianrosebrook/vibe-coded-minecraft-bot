import { Task, TaskType } from '../../types/task';
import { WorldState, ResourceTracker } from '../../types/world';
import { Hotspot } from '../../types/hotspot';
import { ErrorCategory, ErrorSeverity } from '../../types/common';

export interface BotState {
  health: number;
  hunger: number;
  position: { x: number; y: number; z: number };
  inventory: Array<{
    type: string;
    count: number;
    slot: number;
  }>;
  equipment: Array<{
    type: string;
    durability: number;
    slot: string;
  }>;
  activeTasks: Task[];
}

export interface ContextAwareTypeDetectionResult {
  type: TaskType;
  confidence: number;
  contextReasons: string[];
  warnings: string[];
  alternatives: Array<{
    type: TaskType;
    confidence: number;
    reasons: string[];
  }>;
}

export class ContextAwareTypeDetector {
  private botState: BotState;
  private worldState: WorldState;
  private resourceTrackers: Map<string, ResourceTracker>;
  private hotspots: Map<string, Hotspot>;

  constructor(
    botState: BotState,
    worldState: WorldState,
    resourceTrackers: Map<string, ResourceTracker>,
    hotspots: Map<string, Hotspot>
  ) {
    this.botState = botState;
    this.worldState = worldState;
    this.resourceTrackers = resourceTrackers;
    this.hotspots = hotspots;
  }

  public async detectTaskType(task: Task): Promise<ContextAwareTypeDetectionResult> {
    const baseType = task.type;
    const contextChecks = await this.performContextChecks(task);
    const confidence = this.calculateConfidence(contextChecks);
    const alternatives = await this.generateAlternatives(task, contextChecks);

    return {
      type: await this.determineFinalType(baseType, contextChecks, confidence),
      confidence,
      contextReasons: this.extractContextReasons(contextChecks),
      warnings: this.extractWarnings(contextChecks),
      alternatives
    };
  }

  private async performContextChecks(task: Task): Promise<ContextCheckResults> {
    return {
      healthCheck: this.checkHealthRequirements(task),
      inventoryCheck: await this.checkInventoryRequirements(task),
      equipmentCheck: await this.checkEquipmentRequirements(task),
      positionCheck: this.checkPositionRequirements(task),
      taskDependencyCheck: this.checkTaskDependencies(task),
      resourceAvailabilityCheck: await this.checkResourceAvailability(task),
      pathfindingCheck: await this.checkPathfindingPossibility(task)
    };
  }

  private checkHealthRequirements(task: Task): ContextCheck {
    const minHealth = this.getTaskHealthRequirement(task);
    return {
      passed: this.botState.health >= minHealth,
      reason: `Health check: ${this.botState.health}/${minHealth}`,
      severity: this.botState.health < minHealth ? 'HIGH' : 'LOW'
    };
  }

  private async checkInventoryRequirements(task: Task): Promise<ContextCheck> {
    const requiredItems = this.getRequiredItems(task);
    const missingItems = requiredItems.filter(item => 
      !this.botState.inventory.some(invItem => 
        invItem.type === item.type && invItem.count >= item.count
      )
    );

    return {
      passed: missingItems.length === 0,
      reason: missingItems.length > 0 
        ? `Missing items: ${missingItems.map(i => i.type).join(', ')}`
        : 'All required items available',
      severity: missingItems.length > 0 ? 'MEDIUM' : 'LOW'
    };
  }

  private async checkEquipmentRequirements(task: Task): Promise<ContextCheck> {
    const requiredTools = this.getRequiredTools(task);
    const missingTools = requiredTools.filter(tool =>
      !this.botState.equipment.some(eq => 
        eq.type === tool.type && eq.durability >= tool.minDurability
      )
    );

    return {
      passed: missingTools.length === 0,
      reason: missingTools.length > 0
        ? `Missing or damaged tools: ${missingTools.map(t => t.type).join(', ')}`
        : 'All required tools available',
      severity: missingTools.length > 0 ? 'MEDIUM' : 'LOW'
    };
  }

  private checkPositionRequirements(task: Task): ContextCheck {
    const requiredPosition = this.getRequiredPosition(task);
    if (!requiredPosition) {
      return {
        passed: true,
        reason: 'No position requirements',
        severity: 'LOW'
      };
    }

    const distance = this.calculateDistance(this.botState.position, requiredPosition);
    return {
      passed: distance <= this.getMaxDistance(task),
      reason: `Distance to target: ${distance.toFixed(2)} blocks`,
      severity: distance > this.getMaxDistance(task) ? 'MEDIUM' : 'LOW'
    };
  }

  private checkTaskDependencies(task: Task): ContextCheck {
    const dependencies = this.getTaskDependencies(task);
    const unmetDependencies = dependencies.filter(dep =>
      !this.botState.activeTasks.some(activeTask => 
        activeTask.type === dep.type && activeTask.status === 'completed'
      )
    );

    return {
      passed: unmetDependencies.length === 0,
      reason: unmetDependencies.length > 0
        ? `Unmet dependencies: ${unmetDependencies.map(d => d.type).join(', ')}`
        : 'All dependencies met',
      severity: unmetDependencies.length > 0 ? 'HIGH' : 'LOW'
    };
  }

  private async checkResourceAvailability(task: Task): Promise<ContextCheck> {
    const requiredResources = this.getRequiredResources(task);
    const unavailableResources = requiredResources.filter(resource => {
      const tracker = this.resourceTrackers.get(resource.type);
      return !tracker || tracker.locations.length === 0;
    });

    return {
      passed: unavailableResources.length === 0,
      reason: unavailableResources.length > 0
        ? `Unavailable resources: ${unavailableResources.map(r => r.type).join(', ')}`
        : 'All required resources available',
      severity: unavailableResources.length > 0 ? 'HIGH' : 'LOW'
    };
  }

  private async checkPathfindingPossibility(task: Task): Promise<ContextCheck> {
    const targetPosition = this.getRequiredPosition(task);
    if (!targetPosition) {
      return {
        passed: true,
        reason: 'No pathfinding required',
        severity: 'LOW'
      };
    }

    // TODO: Implement actual pathfinding check using mineflayer-pathfinder
    const pathExists = true; // Placeholder

    return {
      passed: pathExists,
      reason: pathExists ? 'Path to target exists' : 'No path to target found',
      severity: pathExists ? 'LOW' : 'HIGH'
    };
  }

  private calculateConfidence(checks: ContextCheckResults): number {
    const typeWeights: Record<TaskType, number> = {
      [TaskType.MINING]: 0.15,
      [TaskType.CRAFTING]: 0.12,
      [TaskType.NAVIGATION]: 0.12,
      [TaskType.GATHERING]: 0.12,
      [TaskType.FARMING]: 0.12,
      [TaskType.COMBAT]: 0.12,
      [TaskType.HEALING]: 0.12,
      [TaskType.QUERY]: 0.12,
      [TaskType.INVENTORY]: 0.12,
      [TaskType.INTERACTION]: 0.12,
      [TaskType.CHAT]: 0.12,
      [TaskType.UNKNOWN]: 0.12
    };

    let totalConfidence = 0;
    for (const [check, result] of Object.entries(checks)) {
      const weight = typeWeights[check as keyof typeof typeWeights];
      totalConfidence += result.passed ? weight : 0;
    }

    return totalConfidence;
  }

  private async generateAlternatives(
    task: Task,
    checks: ContextCheckResults
  ): Promise<Array<{ type: TaskType; confidence: number; reasons: string[] }>> {
    const alternatives: Array<{ type: TaskType; confidence: number; reasons: string[] }> = [];

    // Generate alternatives based on failed checks
    if (!checks.inventoryCheck.passed) {
      alternatives.push({
        type: TaskType.GATHERING,
        confidence: 0.7,
        reasons: ['Missing required items, suggesting gathering task first']
      });
    }

    if (!checks.equipmentCheck.passed) {
      alternatives.push({
        type: TaskType.CRAFTING,
        confidence: 0.8,
        reasons: ['Missing required tools, suggesting crafting task first']
      });
    }

    if (!checks.healthCheck.passed) {
      alternatives.push({
        type: TaskType.HEALING,
        confidence: 0.9,
        reasons: ['Low health, suggesting healing task first']
      });
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence);
  }

  private async determineFinalType(
    baseType: TaskType,
    checks: ContextCheckResults,
    confidence: number
  ): Promise<TaskType> {
    // If confidence is too low, return the highest confidence alternative
    if (confidence < 0.5) {
      const alternatives = await this.generateAlternatives({ type: baseType } as Task, checks);
      return alternatives.length > 0 ? alternatives[0].type : baseType;
    }

    return baseType;
  }

  private extractContextReasons(checks: ContextCheckResults): string[] {
    return Object.values(checks)
      .filter(check => check.passed)
      .map(check => check.reason);
  }

  private extractWarnings(checks: ContextCheckResults): string[] {
    return Object.values(checks)
      .filter(check => !check.passed)
      .map(check => check.reason);
  }

  // Helper methods for getting task requirements
  private getTaskHealthRequirement(task: Task): number {
    // Default health requirements based on task type
    const requirements: Record<TaskType, number> = {
      [TaskType.MINING]: 10,
      [TaskType.CRAFTING]: 5,
      [TaskType.NAVIGATION]: 8,
      [TaskType.GATHERING]: 8,
      [TaskType.FARMING]: 6,
      [TaskType.COMBAT]: 15,
      [TaskType.HEALING]: 1,
      [TaskType.QUERY]: 1,
      [TaskType.CHAT]: 1,
      [TaskType.INVENTORY]: 1,
      [TaskType.INTERACTION]: 1,
      [TaskType.UNKNOWN]: 1
    };

    return requirements[task.type] || 5;
  }

  private getRequiredItems(task: Task): Array<{ type: string; count: number }> {
    // TODO: Implement based on task parameters
    return [];
  }

  private getRequiredTools(task: Task): Array<{ type: string; minDurability: number }> {
    // TODO: Implement based on task parameters
    return [];
  }

  private getRequiredPosition(task: Task): { x: number; y: number; z: number } | null {
    // TODO: Implement based on task parameters
    return null;
  }

  private getTaskDependencies(task: Task): Array<{ type: TaskType }> {
    // TODO: Implement based on task parameters
    return [];
  }

  private getRequiredResources(task: Task): Array<{ type: string }> {
    // TODO: Implement based on task parameters
    return [];
  }

  private getMaxDistance(task: Task): number {
    // Default maximum distances based on task type
    const distances: Record<TaskType, number> = {
      [TaskType.MINING]: 64,
      [TaskType.CRAFTING]: 0,
      [TaskType.NAVIGATION]: 128,
      [TaskType.GATHERING]: 64,
      [TaskType.FARMING]: 32,
      [TaskType.COMBAT]: 32,
      [TaskType.HEALING]: 0,
      [TaskType.QUERY]: 0,
      [TaskType.INVENTORY]: 0,
      [TaskType.INTERACTION]: 32,
      [TaskType.UNKNOWN]: 0
    };

    return distances[task.type] || 32;
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }
}

interface ContextCheck {
  passed: boolean;
  reason: string;
  severity: ErrorSeverity;
}

interface ContextCheckResults {
  healthCheck: ContextCheck;
  inventoryCheck: ContextCheck;
  equipmentCheck: ContextCheck;
  positionCheck: ContextCheck;
  taskDependencyCheck: ContextCheck;
  resourceAvailabilityCheck: ContextCheck;
  pathfindingCheck: ContextCheck;
} 