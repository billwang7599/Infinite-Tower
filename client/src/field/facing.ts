/**
 * Which way a field walker faces: toward the camera ("down" the screen), away ("up"), or to a side. The player's
 * chibi has a picture for each (front, back, side; left mirrors right). +z is up the screen.
 */

export type Facing = "down" | "up" | "left" | "right";

/** Less than this on an axis (of a 0-1 input) isn't walking that way. */
const DEAD_ZONE = 0.1;

/**
 * Facing after walking (moveX, moveZ). It keeps facing a way it's still walking, so a diagonal doesn't flicker
 * between two pictures; otherwise it turns to the stronger axis, sideways on a tie. Standing still keeps it.
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
