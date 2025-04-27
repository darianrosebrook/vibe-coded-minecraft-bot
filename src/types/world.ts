import { Vec3, BlockState } from "./common";

export interface WorldMap {
  chunks: Map<string, ChunkData>;
  entities: Map<string, EntityData>;
  lastUpdated: number;
}

export interface ChunkData {
  position: Vec3;
  blocks: Map<string, BlockState>;
  lastUpdated: number;
}

export interface EntityData {
  id: string;
  type: string;
  position: Vec3;
  metadata: Record<string, any>;
  lastUpdated: number;
}

export interface ResourceTracker {
  type: string;
  locations: Vec3[];
  lastSeen: number;
  yieldHistory: number[];
}

export interface BiomeData {
  id: string;
  name: string;
  temperature: number;
  rainfall: number;
  features: string[];
  blocks: Set<string>;
}

export interface WorldState {
  time: number;
  weather: "clear" | "rain" | "thunder";
  difficulty: "peaceful" | "easy" | "normal" | "hard";
  gameMode: "survival" | "creative" | "adventure" | "spectator";
  dimension: "overworld" | "nether" | "end";
}
