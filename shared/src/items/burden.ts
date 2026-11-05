/**
 * What carrying too much does, like Dark Souls' equip load: over the carry limit, a dodge costs `heavyDodgeCost`
 * times the stamina; over `overloadedAt` times it, no dodging, and walking (overworld and arena) at `overloadedPace`.
 */
import { PLAYER } from "../battle/player.js";
import { carryLimit, moveSpeed, type Stats } from "../battle/stats.js";
import { gearWeight, type Carried, type Gear } from "./gear.js";

export const BURDEN = { overloadedAt: 1.2, heavyDodgeCost: 1.3, overloadedPace: 0.5 } as const;

export type Burden = "light" | "heavy" | "overloaded";

export function burdenOf(weight: number, limit: number): Burden {
  if (weight > limit * BURDEN.overloadedAt) return "overloaded";
  return weight > limit ? "heavy" : "light";
}

export const gearBurden = (gear: Carried, stats: Stats): Burden => burdenOf(gearWeight(gear), carryLimit(stats));

export const walkPace = (burden: Burden): number => burden === "overloaded" ? BURDEN.overloadedPace : 1;

export const overworldPace = (gear: Gear, stats: Stats): number => moveSpeed(walkPace(gearBurden(gear, stats)), stats);

/** null: no dodging at all. */
export function dodgeCost(burden: Burden): number | null {
  if (burden === "overloaded") return null;
  return burden === "heavy" ? PLAYER.dodge.cost * BURDEN.heavyDodgeCost : PLAYER.dodge.cost;
}
