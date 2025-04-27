import { Biome } from 'prismarine-biome';

declare module 'mineflayer' {
  interface WorldSync {
    biome: Biome;
  }
} 