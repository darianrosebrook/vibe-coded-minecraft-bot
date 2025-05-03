import { BlockState } from '@/types/world/block';
import { Vec3 } from 'vec3';

/**
 * Represents the complete world state, including chunks and entities
 */
export interface WorldMap {
  /** Map of chunk coordinates to chunk data */
  chunks: Map<string, ChunkData>;
  /** Map of entity IDs to entity data */
  entities: Map<string, EntityData>;
  /** Timestamp of last update */
  lastUpdated: number;
}

/**
 * Represents a single chunk of the world
 */
export interface ChunkData {
  /** Position of the chunk in the world */
  position: Vec3;
  /** Map of block positions to block states */
  blocks: Map<string, BlockState>;
  /** Timestamp of last update */
  lastUpdated: number;
}

/**
 * Represents an entity in the world
 */
export interface EntityData {
  /** Unique identifier for the entity */
  id: string;
  /** Type of entity (e.g., 'player', 'zombie', 'cow') */
  type: string;
  /** Current position of the entity */
  position: Vec3;
  /** Additional entity-specific data */
  metadata: Record<string, any>;
  /** Timestamp of last update */
  lastUpdated: number;
}

/**
 * Tracks resource locations and their yields
 */
export interface ResourceTracker {
  /** Type of resource being tracked */
  type: string;
  /** List of known resource locations */
  locations: Vec3[];
  /** Timestamp of last sighting */
  lastSeen: number;
  /** History of resource yields */
  yieldHistory: number[];
}
 
/**
 * Represents the current world state
 */
export interface WorldState {
  /** Current world time (0-24000) */
  time: number;
  /** Current weather conditions */
  weather: "clear" | "rain" | "thunder";
  /** Current game difficulty */
  difficulty: "peaceful" | "easy" | "normal" | "hard";
  /** Current game mode */
  gameMode: "survival" | "creative" | "adventure" | "spectator";
  /** Current dimension */
  dimension: "overworld" | "nether" | "end";
}
