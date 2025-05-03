import { Vec3 } from 'vec3';

/**
 * Represents a Minecraft biome
 */
export interface Biome {
  id: number;
  name: string;
  category: string;
  temperature: number;
  rainfall: number;
  depth: number;
  scale: number;
  dimension: string;
}

/**
 * Biome data that can be returned from the world tracker
 */
export interface BiomeData extends Biome {
  position: Vec3;
  features: BiomeFeature[];
}

/**
 * Features that can be found in a biome
 */
export interface BiomeFeature {
  type: string;
  rarity: number;
  description: string;
}

/**
 * Biome-specific block information
 */
export interface BiomeBlockInfo {
  blockType: string;
  frequency: number;
  yLevel: number;
  isResource: boolean;
} 