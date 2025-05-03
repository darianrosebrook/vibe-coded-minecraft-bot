import { Vec3 } from 'vec3';

/**
 * Basic block information
 */
export interface Block {
  id: number;
  name: string;
  displayName: string;
  hardness: number;
  resistance: number;
  diggable: boolean;
  transparent: boolean;
  emitLight: number;
  filterLight: number;
}

/**
 * Block state information
 */
export interface BlockState extends Block {
  position: Vec3;
  metadata: number;
  state: Record<string, string | number | boolean>;
}

/**
 * Resource block information
 */
export interface ResourceBlock extends Block {
  isResource: true;
  resourceType: string;
  dropChance: number;
  experience: number;
  toolRequired: string[];
  minYLevel: number;
  maxYLevel: number;
}

/**
 * Block update information
 */
export interface BlockUpdate {
  oldBlock: BlockState | null;
  newBlock: BlockState;
  position: Vec3;
  timestamp: number;
} 