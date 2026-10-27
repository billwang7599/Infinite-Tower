/**
 * What carrying too much does, like Dark Souls' equip load: over the carry limit, a dodge costs `heavyDodgeCost`
 * times the stamina; over `overloadedAt` times it, no dodging, and walking (overworld and arena) at `overloadedPace`.
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

export const walkPace = (burden: Burden): number => burden === "overloaded" ? BURDEN.overloadedPace : 1;

/** null: no dodging at all. */
export function dodgeCost(burden: Burden): number | null {
  if (burden === "overloaded") return null;
  return burden === "heavy" ? PLAYER.dodge.cost * BURDEN.heavyDodgeCost : PLAYER.dodge.cost;
}
