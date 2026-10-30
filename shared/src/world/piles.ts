import { distXZ, wrapAngle, type Vec2 } from "../core/math.js";

/** Centre to centre, in tiles on the overworld and metres in an arena: the same number in both. */
export const PILE_RANGE_M = 2;
/** Either side of the way you face: the camera in an arena, the walker's heading on the overworld. */
export const PILE_LOOK_RAD = (35 * Math.PI) / 180;

export function pileInView<P extends Vec2>(
  me: Vec2, way: Vec2, piles: readonly P[], reachM = PILE_RANGE_M, lookRad = PILE_LOOK_RAD,
): P | null {
  let best: { pile: P; offRad: number } | null = null;
  for (const pile of piles) {
    const dist = distXZ(me, pile);
    if (dist > reachM) continue;
    const wayRad = Math.atan2(pile.x - me.x, pile.z - me.z);
    const offRad = dist === 0 ? 0 : Math.abs(wrapAngle(wayRad - Math.atan2(way.x, way.z)));
    if (offRad <= lookRad && (!best || offRad < best.offRad)) best = { pile, offRad };
  }
  return best?.pile ?? null;
}
