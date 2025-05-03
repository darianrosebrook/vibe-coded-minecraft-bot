import { Vec3 } from 'vec3';

/**
 * Represents a single resource location with its properties
 */
export interface ResourceData {
  /** Position of the resource in the world */
  position: Vec3;
  /** Type of block containing the resource */
  blockType: string;
  /** Expected yield value of the resource */
  yieldValue: number;
  /** Timestamp when the resource was last observed */
  timestamp: number;
}

/**
 * Represents a cluster of resources in a specific area
 */
export interface Hotspot {
  /** Type of resource in the hotspot */
  resourceType: string;
  /** Center position of the hotspot */
  center: Vec3;
  /** Radius of the hotspot in blocks */
  radius: number;
  /** Average yield value of resources in the hotspot */
  averageYield: number;
  /** Timestamp of last update */
  lastUpdated: number;
  /** Number of resources in the hotspot */
  resourceCount: number;
}

/**
 * Represents metrics about hotspot detection and performance
 */
export interface HotspotMetrics {
  /** Total number of hotspots detected */
  totalHotspots: number;
  /** Average yield across all hotspots */
  averageYield: number;
  /** Distribution of resource types across hotspots */
  resourceDistribution: Record<string, number>;
  /** How often hotspots are updated (in ticks) */
  updateFrequency: number;
  /** Accuracy of hotspot predictions (0-1) */
  accuracy: number;
}

/**
 * Configuration for hotspot detection and management
 */
export interface HotspotConfig {
  /** Minimum radius for a valid hotspot (in blocks) */
  minRadius: number;
  /** Maximum radius for a valid hotspot (in blocks) */
  maxRadius: number;
  /** Minimum number of resources required for a hotspot */
  minResources: number;
  /** Minimum yield value for a resource to be considered */
  yieldThreshold: number;
  /** How often to update hotspot data (in ticks) */
  updateInterval: number;
  /** Rate at which hotspot data decays over time (0-1) */
  decayRate: number;
} 