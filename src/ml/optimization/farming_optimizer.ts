import { Vec3 } from 'vec3';
import { FarmingMLState } from '@/types/ml/farming';
import logger from '@/utils/observability/logger';

/**
 * FarmingOptimizer class for optimizing farming routes and strategies
 * Analyzes farming ML state data to improve efficiency over time
 */
export class FarmingOptimizer {
    private currentState: FarmingMLState | null = null;
    private historyStates: FarmingMLState[] = [];
    private optimizationThreshold = 0.8; // 80% efficiency threshold

    constructor() {
        this.reset();
    }

    /**
     * Reset the optimizer state
     */
    public reset(): void {
        this.currentState = null;
        this.historyStates = [];
    }

    /**
     * Update the optimizer with the latest farming state
     * @param state Current farming ML state
     */
    public async updateState(state: FarmingMLState): Promise<void> {
        this.currentState = state;
        this.historyStates.push(state);

        // Keep history limited to last 10 states
        if (this.historyStates.length > 10) {
            this.historyStates.shift();
        }

        // Log current efficiency metrics
        logger.debug('Farming optimizer state updated', {
            cropEfficiency: state.cropDistribution.efficiency,
            waterEfficiency: state.waterCoverage.efficiency,
            pathEfficiency: state.farmingPath.efficiency,
            farmingEfficiency: state.performance.farmingEfficiency
        });
    }

    /**
     * Get optimized farming path based on historical data
     * @returns Optimized path as array of Vec3 points
     */
    public getOptimizedPath(): Vec3[] {
        if (!this.currentState) {
            return [];
        }

        // If current path is already efficient, return it
        if (this.currentState.farmingPath.efficiency > this.optimizationThreshold) {
            return this.currentState.farmingPath.waypoints;
        }

        // Calculate better path based on crop growth and water proximity
        const sortedWaypoints = [...this.currentState.farmingPath.waypoints].sort((a, b) => {
            // Get crop indices for these positions
            // guard against undefined
            const aIndex = this.findCropIndex(a);
            const bIndex = this.findCropIndex(b);

            if (aIndex === -1 || bIndex === -1) {
                if (!a || !b) return 0;
      return 0;
            }

            // Check if these positions have crop data
            const aGrowth = this.currentState?.cropDistribution.growth[aIndex] ?? 0;
            const bGrowth = this.currentState?.cropDistribution.growth[bIndex] ?? 0;

            // Prioritize by growth level (higher growth = harvest sooner)
            return bGrowth - aGrowth;
        });

        return sortedWaypoints;
    }

    /**
     * Find the index of a crop position in the current state
     * @param position Position to find
     * @returns Index of the crop or -1 if not found
     */
    private findCropIndex(position: Vec3): number {
        if (!this.currentState) return -1;

        return this.currentState.cropDistribution.positions.findIndex(p =>
            p.x === position.x && p.y === position.y && p.z === position.z
        );
    }

    /**
     * Analyze crop growth patterns to determine optimal harvest timing
     * @returns Map of positions to optimal harvest times
     */
    public analyzeGrowthPatterns(): Map<string, number> {
        const harvestTimes = new Map<string, number>();

        if (!this.currentState || this.historyStates.length < 2) {
            return harvestTimes;
        }

        // Analyze historical growth rates
        for (const position of this.currentState.cropDistribution.positions) {
            const posKey = `${position.x},${position.y},${position.z}`;
            const growthRate = this.calculateGrowthRate(position);

            // Calculate estimated time to full growth
            const index = this.findCropIndex(position);
            if (index !== -1) {
                const currentGrowth = this.currentState.cropDistribution.growth[index] ?? 0 ?? 0;
                const timeToFull = (7 - currentGrowth) / (growthRate || 0.01);
                harvestTimes.set(posKey, Date.now() + timeToFull * 1000 * 60); // Convert to milliseconds
            }
        }

        return harvestTimes;
    }

    /**
     * Calculate growth rate for a specific position based on history
     * @param position Position to analyze
     * @returns Growth rate in growth units per minute
     */
    private calculateGrowthRate(position: Vec3): number {
        if (this.historyStates.length < 2) return 0;

        let previousGrowth: number | null = null;
        let previousTime: number | null = null;
        let totalGrowthRate = 0;
        let countMeasurements = 0;

        // Calculate average growth rate across history
        for (let i = 0; i < this.historyStates.length; i++) {
            const state = this.historyStates[i];
            if (!state) continue;
            const index = state.cropDistribution.positions.findIndex(p =>
                p.x === position.x && p.y === position.y && p.z === position.z
            );

            if (index !== -1) {
                const currentGrowth = state.cropDistribution.growth[index] ?? 0 ?? 0;
                const currentTime = i; // Using index as proxy for time

                if (previousGrowth !== null && previousTime !== null) {
                    const growthDiff = currentGrowth - previousGrowth;
                    const timeDiff = currentTime - previousTime;
                    if (timeDiff > 0) {
                        totalGrowthRate += growthDiff / timeDiff;
                        countMeasurements++;
                    }
                }

                previousGrowth = currentGrowth;
                previousTime = currentTime;
            }
        }

        return countMeasurements > 0 ? totalGrowthRate / countMeasurements : 0;
    }
} 