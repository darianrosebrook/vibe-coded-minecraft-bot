import { Vec3 } from 'vec3';
import { BlockState } from './block';
import { Biome } from './biome';
import { ChunkPosition } from '../core';

/**
 * Chunk data structure
 */
export interface Chunk {
  position: ChunkPosition;
  blocks: Map<string, BlockState>; // key: `${x}:${y}:${z}`
  biomes: Map<string, Biome>; // key: `${x}:${z}`
  heightMap: number[][]; // 16x16 array of height values
  lastUpdate: number;
}

/**
 * Chunk column information
 */
export interface ChunkColumn {
  x: number;
  z: number;
  bitMap: number;
  chunkData: Buffer;
  blockEntities: Record<string, unknown>;
  biomes: number[];
} 