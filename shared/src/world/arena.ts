import { distXZ, wrapAngle, type Vec2 } from "../core/math.js";

export const ARENA_LOOK_IDS = ["forest-clearing", "stone-ruins", "mire"] as const;
export type ArenaLook = (typeof ARENA_LOOK_IDS)[number];

export interface ArenaDef {
  id: string;
  radius: number;
  look: ArenaLook;
}

/** Center to center, like the overworld's reaches. */
export const ARENA_PILE_RANGE_M = 2;
/** Either side of where the camera faces. */
export const ARENA_PILE_LOOK_RAD = (35 * Math.PI) / 180;

export function pileInView<P extends Vec2>(
  me: Vec2, aim: Vec2, piles: readonly P[], reachM = ARENA_PILE_RANGE_M, lookRad = ARENA_PILE_LOOK_RAD,
): P | null {
  let best: { pile: P; offRad: number } | null = null;
  for (const pile of piles) {
    const dist = distXZ(me, pile);
    if (dist > reachM) continue;
    const wayRad = Math.atan2(pile.x - me.x, pile.z - me.z);
    const offRad = dist === 0 ? 0 : Math.abs(wrapAngle(wayRad - Math.atan2(aim.x, aim.z)));
    if (offRad <= lookRad && (!best || offRad < best.offRad)) best = { pile, offRad };
  }
  return best?.pile ?? null;
}
