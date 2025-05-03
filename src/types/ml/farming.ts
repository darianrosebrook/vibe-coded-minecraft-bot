/**
 * Farming ML Types
 * 
 * Types related to farming operations, crop management, and automated agriculture.
 */

import { Vec3 } from 'vec3';

// Basic farm environment types
export interface FarmEnvironment {
  soilMoisture: number;
  lightLevel: number;
  biome: string;
  temperature: number;
  rainfall: number;
}

// Crop growth stages and properties
export interface CropData {
  type: string;
  growthStage: number;
  maxGrowthStage: number;
  growthRate: number;
  waterNeeds: number;
  timeToHarvest: number;
}

// Farm layout and organization
export interface FarmLayout {
  dimensions: {
    width: number;
    length: number;
  };
  plotArrangement: string;
  cropDistribution: Record<string, number>;
  waterSources: Vec3[];
  lightSources: Vec3[];
}

// Automated farming system
export interface FarmingSystem {
  type: 'manual' | 'semi-automated' | 'fully-automated';
  components: string[];
  efficiencyRating: number;
  redstoneComplexity: number;
}

// Farming ML prediction types
export interface CropYieldPrediction {
  cropType: string;
  predictedYield: number;
  confidence: number;
  timeToMaturity: number;
  influencingFactors: string[];
}

export interface FarmOptimizationSuggestion {
  type: 'layout' | 'crop-selection' | 'automation' | 'resource-efficiency';
  description: string;
  expectedImprovement: number;
  implementationDifficulty: number;
  resourceRequirements: Record<string, number>;
}

// Crop distribution tracking
export interface CropDistribution {
  type: string;
  positions: Vec3[];
  growth: number[];
  efficiency: number;
}

export interface WaterCoverage {
  sources: Vec3[];
  coverage: number;
  efficiency: number;
}

export interface FarmingPath {
  waypoints: Vec3[];
  distance: number;
  efficiency: number;
}

export interface FarmingPerformance {
  farmingEfficiency: number;
  harvestRate: number;
  growthRate: number;
}

// Comprehensive farming ML state
export interface FarmingMLState {
  farms: Record<string, {
    layout: FarmLayout;
    crops: CropData[];
    environment: FarmEnvironment;
    system: FarmingSystem;
    lastHarvest: number;
    predictedNextHarvest: number;
    yieldHistory: {
      timestamp: number;
      cropType: string;
      amount: number;
    }[];
  }>;
  predictions: {
    yields: CropYieldPrediction[];
    optimizations: FarmOptimizationSuggestion[];
  };
  cropDistribution: CropDistribution;
  waterCoverage: WaterCoverage;
  farmingPath: FarmingPath;
  performance: FarmingPerformance;
  currentFarmingTask?: string;
  farmingSkillLevel: number;
  timestamp: number;
} 