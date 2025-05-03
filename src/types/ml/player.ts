import { Vec3 } from 'vec3';

/**
 * Represents the current state of a player in the Minecraft world
 */
export interface PlayerState {
  position: Vec3;
  health: number;
  food: number;
  inventory: Array<{
    name: string;
    count: number;
    slot: number;
  }>;
  experience: any;
  level: number;
  currentLocation: Vec3;
  currentBiome: string;
  activeTask?: string;
  activeTaskProgress?: number;
} 