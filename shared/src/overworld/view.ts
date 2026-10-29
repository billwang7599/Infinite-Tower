/**
 * How much of the overworld a screen shows, at most 16:9, so no screen shape sees more. The client's camera and the
 * server's choice of actors to send both follow it.
 */
import { clamp, type Vec2 } from "../core/math.js";
import type { LevelLayout } from "../world/layout.js";
import { mapHalfSize } from "../world/tiles.js";

export const VIEW = {
  /** Tiles visible above and below the camera's center. */
  halfHeight: 6.5,
  /** Widest width:height a screen shows. The client's page frame (#stage) is held to it too. */
  maxAspect: 16 / 9,
  /** How far past the level's edge the camera may show (the border art). */
  overscan: 3,
} as const;

/** Half the visible width, in tiles, on a screen of this width:height. */
export function viewHalfWidth(aspect: number): number {
  return VIEW.halfHeight * Math.min(aspect, VIEW.maxAspect);
}

/** Where the camera centers to follow `pos`: on it, except near the level's edge, where it stops. */
export function viewCenter(level: LevelLayout, pos: Vec2, halfViewWidth: number): Vec2 {
  const { halfWidth, halfDepth } = mapHalfSize(level);
  const maxX = Math.max(0, halfWidth + VIEW.overscan - halfViewWidth);
  const maxZ = Math.max(0, halfDepth + VIEW.overscan - VIEW.halfHeight);
  return { x: clamp(pos.x, -maxX, maxX), z: clamp(pos.z, -maxZ, maxZ) };
}
