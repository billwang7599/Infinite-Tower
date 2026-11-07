import { physicalDamage, type Stats } from "../battle/stats.js";
import { clamp } from "../core/math.js";
import { bagCounts, type Bag } from "../items/bag.js";
import type { AmmoId } from "../items/items.js";
import { feltHeft, type Weapon } from "./weapons.js";

/** Lengths in m, speeds in m/s, times in s. `release*M`: where it leaves the bow, from the shooter's center. */
export interface ProjectileDef {
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
  ammo: AmmoId;
  /** `cost` is paid as the draw starts; a release before `minTime` looses once it's reached. */
  draw: {
    cost: number; minTime: number; fullTime: number; minDamageShare: number; minSpeedShare: number; moveFactor: number;
  };
  /** After a loose, before the next draw can start: by where the next arrow comes from. */
  nock: { quiverTime: number; bagTime: number };
  projectile: ProjectileDef;
}

// Placeholders, every one: how bows play is the user's to decide (AGENTS.md, "Bows").
export const BOW = {
  style: "ranged",
  ammo: "arrow",
  draw: { cost: 8, minTime: 0.25, fullTime: 1, minDamageShare: 0.3, minSpeedShare: 0.4, moveFactor: 0.5 },
  nock: { quiverTime: 0.3, bagTime: 0.8 },
  projectile: {
    gravityMps2: -9.8, lifeTime: 3, stuckTime: 2, radiusM: 0.05, poiseDamage: 10, releaseUpM: 0.15, releaseOutM: 0.6,
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

const byDraw = (min: number, share: number): number => min + (1 - min) * share;

export function loosedDamage(moves: RangedMoves, weapon: Weapon, drawnTime: number, stats: Stats): number {
  const share = drawnShare(moves, weapon, stats.strength, drawnTime);
  return physicalDamage(weapon.damage * byDraw(moves.draw.minDamageShare, share), stats);
}

export function loosedSpeed(moves: RangedMoves, weapon: Weapon, strength: number, drawnTime: number): number {
  return (weapon.powerMps ?? 0) * byDraw(moves.draw.minSpeedShare, drawnShare(moves, weapon, strength, drawnTime));
}

export const nockTime = (moves: RangedMoves, quiver: Bag): number =>
  (bagCounts(quiver)[moves.ammo] ?? 0) > 0 ? moves.nock.quiverTime : moves.nock.bagTime;
