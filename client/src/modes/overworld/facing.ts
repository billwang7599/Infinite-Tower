/**
 * Ways in the overworld: on the map (a Heading: +z is north, +x east) and on the screen (a Facing), which the
 * camera's turns right from north (in quarter turns, any part of one) tie together; and how the camera tilts.
 */
import { OVERWORLD_CAMERA_ANGLES, type Heading } from "@infinite-tower/shared";

export type Facing = "up" | "right" | "down" | "left";

const HEADINGS: readonly Heading[] = ["north", "east", "south", "west"];
const FACINGS: readonly Facing[] = ["up", "right", "down", "left"];

/** The server sends actors' facing as a side, 1 (east) or -1 (west): boars are only ever drawn side-on. */
export const headingFromSide = (side: 1 | -1): Heading => (side === 1 ? "east" : "west");

const quarter = (turns: number) =>
  ((turns % OVERWORLD_CAMERA_ANGLES) + OVERWORLD_CAMERA_ANGLES) % OVERWORLD_CAMERA_ANGLES;

// A whole quarter turn's cos and sin come out as exactly 0, so the keys' moves stay exact.
const exact = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

/** The walk keys (x right, z forward: away from the camera) as a move on the map. `+ 0` keeps -0 off the wire. */
export function mapMove(keys: { x: number; z: number }, turns: number): { x: number; z: number } {
  const rad = (turns * 2 * Math.PI) / OVERWORLD_CAMERA_ANGLES, cos = exact(Math.cos(rad)), sin = exact(Math.sin(rad));
  return { x: keys.x * cos + keys.z * sin + 0, z: keys.z * cos - keys.x * sin + 0 };
}

// Counted on past a full turn, so the compass slides the short way round.
export function unwrapTurns(previous: number, turns: number): number {
  const ahead = quarter(turns - previous);
  return previous + (ahead > OVERWORLD_CAMERA_ANGLES / 2 ? ahead - OVERWORLD_CAMERA_ANGLES : ahead);
}

export const facingOnScreen = (heading: Heading, turns: number): Facing =>
  FACINGS[quarter(HEADINGS.indexOf(heading) - Math.round(turns))]!;

/** -1 to mirror a picture drawn facing right (the side views), 1 for every other way. */
export const mirrorFor = (facing: Facing): 1 | -1 => (facing === "left" ? -1 : 1);

// The camera's angle above the ground, looking at you (straight down is π/2), with no limit. The world is drawn as far
// as it sees at `drawnForRad`; tilted lower, the far ground is in the fog.
export const CAMERA_PITCH = { startRad: (50 * Math.PI) / 180, drawnForRad: (25 * Math.PI) / 180 } as const;
