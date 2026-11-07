import { physicalDamage, type Stats } from "../battle/stats.js";
import { clamp } from "../core/math.js";
import type { ItemId } from "../items/items.js";
import { feltHeft, type Weapon } from "./weapons.js";

/** Lengths in m, speeds in m/s, times in s. `release*M`: where it leaves the bow, from the shooter's center. */
export interface ProjectileDef {
  speedMps: number;
  gravityMps2: number;
  lifeTime: number;
  /** In the floor or the wall, it lies this long before it's gone. */
  stuckTime: number;
  radiusM: number;
  poiseDamage: number;
  releaseUpM: number;
  releaseOutM: number;
}

export interface RangedMoves {
  style: "ranged";
  ammo: ItemId;
  /** `cost` is paid as the draw starts; a release before `minTime` looses once it's reached. */
  draw: { cost: number; minTime: number; fullTime: number; minDamageShare: number; moveFactor: number };
  looseRecoverTime: number;
  projectile: ProjectileDef;
}

// Placeholders, every one: how bows play is the user's to decide (AGENTS.md, "Bows, a prep").
export const BOW = {
  style: "ranged",
  ammo: "arrow",
  draw: { cost: 8, minTime: 0.25, fullTime: 1, minDamageShare: 0.3, moveFactor: 0.5 },
  looseRecoverTime: 0.2,
  projectile: {
    speedMps: 30, gravityMps2: -9.8, lifeTime: 3, stuckTime: 2, radiusM: 0.05, poiseDamage: 10, releaseUpM: 0.15,
    releaseOutM: 0.6,
  },
} as const satisfies RangedMoves;

/** Heft stretches the draw as it does a swing. */
export const drawTime = (moves: RangedMoves, weapon: Weapon, strength: number, time: "minTime" | "fullTime"): number =>
  moves.draw[time] * feltHeft(weapon, strength);

export const drawCost = (moves: RangedMoves, weapon: Weapon, strength: number): number =>
  moves.draw.cost * feltHeft(weapon, strength);

/** 0 just begun, 1 fully drawn. */
export const drawnShare = (moves: RangedMoves, weapon: Weapon, strength: number, drawnTime: number): number =>
  clamp(drawnTime / drawTime(moves, weapon, strength, "fullTime"), 0, 1);

export function loosedDamage(moves: RangedMoves, weapon: Weapon, drawnTime: number, stats: Stats): number {
  const min = moves.draw.minDamageShare, share = drawnShare(moves, weapon, stats.strength, drawnTime);
  return physicalDamage(weapon.damage * (min + (1 - min) * share), stats);
}
