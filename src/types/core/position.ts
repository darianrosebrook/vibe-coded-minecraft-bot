/**
 * Core position and vector types used throughout the project.
 * These types are fundamental to the bot's spatial awareness and navigation.
 * 
 * @module Position
 */

/**
 * Represents a 3D position in the Minecraft world.
 * 
 * @example
 * ```typescript
 * const playerPosition: Position = {
 *   x: 100.5,
 *   y: 64,
 *   z: -200.3
 * };
 * ```
 */
export interface Position {
  x: number;
  y: number;
  z: number;
}

/**
 * Extends Position with magnitude and direction information.
 * Used for movement and velocity calculations.
 * 
 * @example
 * ```typescript
 * const movementVector: Vector = {
 *   x: 1,
 *   y: 0,
 *   z: 1,
 *   magnitude: Math.sqrt(2),
 *   direction: {
 *     pitch: 0,
 *     yaw: 45
 *   }
 * };
 * ```
 */
export interface Vector extends Position {
  magnitude: number;
  direction: {
    pitch: number;
    yaw: number;
  };
}

/**
 * Defines a 3D bounding box using minimum and maximum positions.
 * Used for area checks and collision detection.
 * 
 * @example
 * ```typescript
 * const miningArea: BoundingBox = {
 *   min: { x: 0, y: 0, z: 0 },
 *   max: { x: 16, y: 16, z: 16 }
 * };
 * ```
 */
export interface BoundingBox {
  min: Position;
  max: Position;
}

/**
 * Represents a chunk position in the Minecraft world.
 * Chunks are 16x16 block areas that form the world grid.
 * 
 * @example
 * ```typescript
 * const currentChunk: ChunkPosition = {
 *   x: 6,
 *   z: -12
 * };
 * ```
 */
export interface ChunkPosition {
  x: number;
  z: number;
}

/**
 * Extends Position with block-specific metadata.
 * Used for precise block manipulation and tracking.
 * 
 * @example
 * ```typescript
 * const targetBlock: BlockPosition = {
 *   x: 100,
 *   y: 64,
 *   z: -200,
 *   metadata: 0  // Block variant or state
 * };
 * ```
 */
export interface BlockPosition extends Position {
  blockId: number;
  metadata?: number;
}

/**
 * Extends Position with entity-specific information.
 * Used for tracking and interacting with entities.
 * 
 * @example
 * ```typescript
 * const zombiePosition: EntityPosition = {
 *   x: 100.5,
 *   y: 64,
 *   z: -200.3,
 *   entityId: 12345,
 *   type: 'zombie',
 *   velocity: {
 *     x: 0.1,
 *     y: 0,
 *     z: 0.1,
 *     magnitude: 0.141,
 *     direction: {
 *       pitch: 0,
 *       yaw: 45
 *     }
 *   }
 * };
 * ```
 */
export interface EntityPosition extends Position {
  entityId: number;
  type: string;
  velocity?: Vector;
} 