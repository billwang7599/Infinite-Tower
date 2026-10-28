/**
 * Which way an overworld walker faces on the screen: toward the camera ("down"), away ("up"), or to a side. +z is up
 * the screen. The player's chibi has a picture for each: its ChibiFacing (gfx/look/) is front for down, back for
 * up, and side for either side, mirrored for left (mirrorFor).
 */

export type Facing = "down" | "up" | "left" | "right";

/** Less than this on an axis (of a 0-1 input) isn't walking that way. */
const DEAD_ZONE = 0.1;

/**
 * Facing after walking (moveX, moveZ). It keeps facing a way it's still walking, so a diagonal doesn't flicker
 * between two pictures; otherwise it faces the stronger axis, sideways on a tie. Standing still keeps it.
 */
export function faceToward(current: Facing, moveX: number, moveZ: number): Facing {
  const walking: Record<Facing, boolean> = {
    left: moveX < -DEAD_ZONE, right: moveX > DEAD_ZONE, down: moveZ < -DEAD_ZONE, up: moveZ > DEAD_ZONE,
  };
  if (walking[current]) return current;
  if (walking.left || walking.right || walking.up || walking.down) {
    if (Math.abs(moveX) >= Math.abs(moveZ)) return moveX > 0 ? "right" : "left";
    return moveZ > 0 ? "up" : "down";
  }
  return current;
}

/** The server sends actors' facing as a side, 1 (right) or -1 (left): boars are only ever seen side-on. */
export const facingFromSide = (side: 1 | -1): Facing => (side === 1 ? "right" : "left");

/** -1 to mirror a picture drawn facing right (the side views), 1 for every other way. */
export const mirrorFor = (facing: Facing): 1 | -1 => (facing === "left" ? -1 : 1);
