/**
 * Ways in the overworld: on the map (a Heading: +z is north, +x east) and on the screen (a Facing), which the
 * camera's quarter turns right from north tie together; and how far the camera tilts.
 */
import { clamp, OVERWORLD_CAMERA_ANGLES, type Heading } from "@infinite-tower/shared";

export type Facing = "up" | "right" | "down" | "left";

const HEADINGS: readonly Heading[] = ["north", "east", "south", "west"];
const FACINGS: readonly Facing[] = ["up", "right", "down", "left"];

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

// The camera's angle above the ground, looking at you: straight down would be π/2.
export const CAMERA_PITCH = {
  startRad: (50 * Math.PI) / 180, minRad: (25 * Math.PI) / 180, maxRad: (65 * Math.PI) / 180, radPerSec: 1,
} as const;

export const tiltCamera = (pitchRad: number, look: number, dt: number): number =>
  clamp(pitchRad + look * CAMERA_PITCH.radPerSec * dt, CAMERA_PITCH.minRad, CAMERA_PITCH.maxRad);
