import { Vec3 } from 'vec3';
import { Block } from 'prismarine-block';

interface ResourceData {
  position: Vec3;
  blockType: string;
  resourceYield: number;
  timestamp: number;
}

interface Hotspot {
  resourceType: string;
  position: Vec3;
  confidence: number;
  lastUpdated: number;
}

export class HotspotTracker {
  private resourceData: ResourceData[] = [];
  private hotspots: Map<string, Hotspot[]> = new Map();
  private readonly maxDataPoints = 1000;
  private readonly minSamplesForHotspot = 10;
  private readonly maxHotspotRadius = 32;
  private readonly DECAY_RATE = 0.1; // 10% decay per day

  constructor() {}

  /**
   * Record a new resource discovery
   */
  public recordResource(position: Vec3, resourceType: string, yieldValue: number = 1): void {
    const now = Date.now();
    const hotspots = this.hotspots.get(resourceType) || [];
    
    // Find existing hotspot within 5 blocks
    const existingHotspot = hotspots.find(h => 
      h.position.distanceTo(position) < 5
    );

    if (existingHotspot) {
      // Update existing hotspot
      existingHotspot.confidence = Math.min(1, existingHotspot.confidence + (yieldValue * 0.1));
      existingHotspot.lastUpdated = now;
    } else {
      // Create new hotspot
      hotspots.push({
        resourceType,
        position,
        confidence: yieldValue * 0.1,
        lastUpdated: now
      });
    }

    this.hotspots.set(resourceType, hotspots);
  }

  /**
   * Get the best hotspot for a given resource type
   */
  public getBestHotspot(resourceType: string): Hotspot | null {
    const hotspots = this.hotspots.get(resourceType);
    if (!hotspots || hotspots.length === 0) return null;

    // Apply temporal decay
    const now = Date.now();
    hotspots.forEach(hotspot => {
      const daysPassed = (now - hotspot.lastUpdated) / (24 * 60 * 60 * 1000);
      hotspot.confidence *= Math.pow(1 - this.DECAY_RATE, daysPassed);
    });

    // Return hotspot with highest confidence
    return hotspots.reduce((best, current) => 
      current.confidence > (best?.confidence || 0) ? current : best
    );
  }

  /**
   * Update hotspot calculations using DBSCAN clustering
   */
  private updateHotspots(): void {
    // Group data by resource type
    const dataByType = this.groupDataByResourceType();

    // Process each resource type
    this.hotspots = new Map();
    for (const [resourceType, data] of Object.entries(dataByType)) {
      if (data.length < this.minSamplesForHotspot) continue;

      const clusters = this.dbscan(data, this.maxHotspotRadius / 2, this.minSamplesForHotspot);
      
      // Convert clusters to hotspots
      const hotspots: Hotspot[] = [];
      for (const cluster of clusters) {
        const center = this.calculateClusterCenter(cluster);
        const radius = this.calculateClusterRadius(cluster, center);
        const averageYield = this.calculateAverageYield(cluster);
        const confidence = this.calculateConfidence(cluster);

        hotspots.push({
          resourceType,
          position: center,
          confidence,
          lastUpdated: Date.now()
        });
      }

      this.hotspots.set(resourceType, hotspots);
    }
  }

  /**
   * Group resource data by type
   */
  private groupDataByResourceType(): Record<string, ResourceData[]> {
    return this.resourceData.reduce((groups, data) => { 
      const blockGroup = groups[data.blockType];
      if (blockGroup) {
        blockGroup.push(data);
      } else {
        groups[data.blockType] = [data];
      }
      return groups;
    }, {} as Record<string, ResourceData[]>);
  }

  /**
   * DBSCAN clustering algorithm implementation
   */
  private dbscan(data: ResourceData[], eps: number, minPts: number): ResourceData[][] {
    const clusters: ResourceData[][] = [];
    const visited = new Set<ResourceData>();
    const noise = new Set<ResourceData>();

    for (const point of data) {
      if (visited.has(point)) continue;

      visited.add(point);
      const neighbors = this.getNeighbors(point, data, eps);

      if (neighbors.length < minPts) {
        noise.add(point);
      } else {
        const cluster: ResourceData[] = [];
        this.expandCluster(point, neighbors, cluster, visited, data, eps, minPts);
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Expand a cluster in DBSCAN
   */
  private expandCluster(
    point: ResourceData,
    neighbors: ResourceData[],
    cluster: ResourceData[],
    visited: Set<ResourceData>,
    data: ResourceData[],
    eps: number,
    minPts: number
  ): void {
    cluster.push(point);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        const neighborNeighbors = this.getNeighbors(neighbor, data, eps);

        if (neighborNeighbors.length >= minPts) {
          neighbors.push(...neighborNeighbors);
        }
      }

      if (!cluster.includes(neighbor)) {
        cluster.push(neighbor);
      }
    }
  }

  /**
   * Get neighbors within epsilon distance
   */
  private getNeighbors(point: ResourceData, data: ResourceData[], eps: number): ResourceData[] {
    return data.filter(p => 
      p !== point && 
      p.position.distanceTo(point.position) <= eps
    );
  }

  /**
   * Calculate cluster center
   */
  private calculateClusterCenter(cluster: ResourceData[]): Vec3 {
    const sum = cluster.reduce((acc, point) => 
      acc.plus(point.position), new Vec3(0, 0, 0)
    );
    return sum.scaled(1 / cluster.length);
  }

  /**
   * Calculate cluster radius
   */
  private calculateClusterRadius(cluster: ResourceData[], center: Vec3): number {
    return Math.max(...cluster.map(point => 
      point.position.distanceTo(center)
    ));
  }

  /**
   * Calculate average yield for a cluster
   */
  private calculateAverageYield(cluster: ResourceData[]): number {
    return cluster.reduce((sum, point) => sum + point.resourceYield, 0) / cluster.length;
  }

  /**
   * Calculate confidence score for a hotspot
   */
  private calculateConfidence(cluster: ResourceData[]): number {
    const sizeConfidence = Math.min(cluster.length / this.minSamplesForHotspot, 1);
    const timeConfidence = this.calculateTimeConfidence(cluster);
    return (sizeConfidence + timeConfidence) / 2;
  }

  /**
   * Calculate time-based confidence
   */
  private calculateTimeConfidence(cluster: ResourceData[]): number {
    const now = Date.now();
    const avgAge = cluster.reduce((sum, point) => 
      sum + (now - point.timestamp), 0
    ) / cluster.length;
    
    // Convert age to days
    const ageInDays = avgAge / (1000 * 60 * 60 * 24);
    return Math.exp(-ageInDays * (1 - this.DECAY_RATE));
  }
} 