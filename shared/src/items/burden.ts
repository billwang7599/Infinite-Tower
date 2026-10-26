/**
 * What carrying too much does, like Dark Souls' equip load. The bag's weight (`bagWeight`) against the carry limit
 * (`carryLimit`, from strength):
 *
 *   light       up to the limit: nothing
 *   heavy       over the limit: a dodge costs `heavyDodgeCost` times the stamina
 *   overloaded  over `overloadedAt` times the limit: no dodging, and walking (overworld and arena) at `overloadedPace`
 *
 * Shared: the server walks the overworld at this pace and the client predicts it; the arena reads the burden the
 * server sends with the encounter.
 */
import { PLAYER } from "../battle/player.js";
import { carryLimit, type Stats } from "../battle/stats.js";
import { bagWeight, type Bag } from "./bag.js";

export const BURDEN = { overloadedAt: 1.2, heavyDodgeCost: 1.3, overloadedPace: 0.5 } as const;

export type Burden = "light" | "heavy" | "overloaded";

export function burdenOf(weight: number, limit: number): Burden {
  if (weight > limit * BURDEN.overloadedAt) return "overloaded";
  return weight > limit ? "heavy" : "light";
}

export const bagBurden = (bag: Bag, stats: Stats): Burden => burdenOf(bagWeight(bag), carryLimit(stats));

/** Share of the normal walking speed. */
export const walkPace = (burden: Burden): number => burden === "overloaded" ? BURDEN.overloadedPace : 1;

/** Stamina a dodge costs, or null when you can't dodge at all. */
export function dodgeCost(burden: Burden): number | null {
  if (burden === "overloaded") return null;
  return burden === "heavy" ? PLAYER.dodge.cost * BURDEN.heavyDodgeCost : PLAYER.dodge.cost;
}
