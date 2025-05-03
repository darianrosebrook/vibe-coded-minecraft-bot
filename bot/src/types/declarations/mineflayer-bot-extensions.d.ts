import { Vec3 } from 'vec3';

declare module 'mineflayer' {
  interface Bot {
    // Core properties
    world: {
      getBiome(position: Vec3): number;
      dimension: string;
    };
    entity: {
      position: Vec3;
      health: number;
    };
    time: {
      timeOfDay: number;
      isDay: boolean;
    };
    isRaining: boolean;
    game: {
      difficulty: string;
      gameMode: string;
      dimension: string;
    };
    health: number;
    food: number;
    inventory: {
      items(): Array<{
        name: string;
        count: number;
        slot: number;
        type: any;
      }>;
    };
    experience: {
      level: number;
      points: number;
      progress: number;
    };
    
    // Custom properties for tracking active tasks
    _activeTask?: {
      name: string;
      // Add any other task properties needed
    } | undefined;
    _activeTaskProgress?: number;
  }
} 