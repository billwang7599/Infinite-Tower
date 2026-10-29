/**
 * Ways in the overworld: on the map (a Heading: +z is north, +x east) and on the screen (a Facing), which the
 * camera's quarter turns right from north tie together.
 */
import { OVERWORLD_CAMERA_ANGLES } from "@infinite-tower/shared";

export type Heading = "north" | "east" | "south" | "west";
export type Facing = "up" | "right" | "down" | "left";

const HEADINGS: readonly Heading[] = ["north", "east", "south", "west"];
const FACINGS: readonly Facing[] = ["up", "right", "down", "left"];

/** Less than this on an axis (of a 0-1 input) isn't walking that way. */
const DEAD_ZONE = 0.1;

/**
 * Heading after walking (moveX, moveZ) on the map. It keeps a way it's still walking, so a diagonal doesn't flicker
 * between two pictures; otherwise it takes the stronger axis, east or west on a tie. Standing still keeps it.
 */
export function faceToward(current: Heading, moveX: number, moveZ: number): Heading {
  const walking: Record<Heading, boolean> = {
    west: moveX < -DEAD_ZONE, east: moveX > DEAD_ZONE, south: moveZ < -DEAD_ZONE, north: moveZ > DEAD_ZONE,
  };
  if (walking[current]) return current;
  if (walking.west || walking.east || walking.north || walking.south) {
    if (Math.abs(moveX) >= Math.abs(moveZ)) return moveX > 0 ? "east" : "west";
    return moveZ > 0 ? "north" : "south";
  }
  return current;
}

/** The server sends actors' facing as a side, 1 (east) or -1 (west): boars are only ever drawn side-on. */
export const headingFromSide = (side: 1 | -1): Heading => (side === 1 ? "east" : "west");

const quarter = (turns: number) =>
  ((turns % OVERWORLD_CAMERA_ANGLES) + OVERWORLD_CAMERA_ANGLES) % OVERWORLD_CAMERA_ANGLES;

/** The walk keys (x right, z forward: away from the camera) as a move on the map. `0 - v` keeps -0 off the wire. */
export function mapMove(keys: { x: number; z: number }, turns: number): { x: number; z: number } {
  const { x, z } = keys;
  switch (quarter(turns)) {
    case 1: return { x: z, z: 0 - x };
    case 2: return { x: 0 - x, z: 0 - z };
    case 3: return { x: 0 - z, z: x };
    default: return { x, z };
  }
}

export const facingOnScreen = (heading: Heading, turns: number): Facing =>
  FACINGS[quarter(HEADINGS.indexOf(heading) - turns)]!;

/** -1 to mirror a picture drawn facing right (the side views), 1 for every other way. */
export const mirrorFor = (facing: Facing): 1 | -1 => (facing === "left" ? -1 : 1);
