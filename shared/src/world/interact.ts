import { distXZ, wrapAngle, type Vec2 } from "../core/math.js";

/** Centre to centre, in tiles on the overworld and metres in an arena: the same number in both. */
export const INTERACT_RANGE_M = 2;
/** Either side of the way you face: the camera in an arena, the walker's heading on the overworld. */
export const INTERACT_LOOK_RAD = (35 * Math.PI) / 180;

/** Of several in reach and in view, the one nearest the way you face, not the nearest. */
export function inView<T extends Vec2>(
  me: Vec2, way: Vec2, things: readonly T[], reachM = INTERACT_RANGE_M, lookRad = INTERACT_LOOK_RAD,
): T | null {
  let best: { thing: T; offRad: number } | null = null;
  for (const thing of things) {
    const dist = distXZ(me, thing);
    if (dist > reachM) continue;
    const wayRad = Math.atan2(thing.x - me.x, thing.z - me.z);
    const offRad = dist === 0 ? 0 : Math.abs(wrapAngle(wayRad - Math.atan2(way.x, way.z)));
    if (offRad <= lookRad && (!best || offRad < best.offRad)) best = { thing, offRad };
  }
  return best?.thing ?? null;
}
