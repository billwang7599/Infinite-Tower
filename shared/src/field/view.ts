/**
 * How much of the field a screen shows. 16:9 is the widest view: wider windows get side bars, taller ones see
 * a little less width, so no screen shape gets to see more. The client's camera and the server's choice of
 * which actors to send (server/src/game/snapshot.ts) both follow these rules.
 */
import { clamp, type Vec2 } from "../core/math.js";
import type { LevelLayout } from "./layout.js";

export const VIEW = {
  /** Tiles visible above and below the camera's center. */
  halfHeight: 6.5,
  /** Widest width:height a screen shows. The client's page frame (#stage) is held to it too. */
  maxAspect: 16 / 9,
  /** How far past the level's edge the camera may show (the border art). */
  overscan: 3,
};

/** Half the visible width, in tiles, on a screen of this width:height. */
export function viewHalfWidth(aspect: number): number {
  return VIEW.halfHeight * Math.min(aspect, VIEW.maxAspect);
}

/** Where the camera centers to follow `pos`: on it, except near the level's edge, where it stops. */
export function viewCenter(level: LevelLayout, pos: Vec2, halfWidth: number): Vec2 {
  const maxX = Math.max(0, level.halfWidth + VIEW.overscan - halfWidth);
  const maxZ = Math.max(0, level.halfDepth + VIEW.overscan - VIEW.halfHeight);
  return { x: clamp(pos.x, -maxX, maxX), z: clamp(pos.z, -maxZ, maxZ) };
}
