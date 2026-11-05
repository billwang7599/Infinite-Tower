import { physicalDamage, type Stats } from "../battle/stats.js";
import { clamp, type Vec3 } from "../core/math.js";
import { bagCounts, type Bag } from "../items/bag.js";
import type { AmmoId } from "../items/items.js";
import { feltHeft, type Weapon } from "./weapons.js";

/** Lengths in m, speeds in m/s, times in s. `release*M`: where it leaves the bow, from the shooter's center. */
export interface ProjectileDef {
  gravityMps2: number;
  dragPerSec: number;
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
    cost: number; minTime: number; fullTime: number; minDamageShare: number; moveFactor: number;
  };
  /** After a loose, before the next draw can start: by where the next arrow comes from. */
  nock: { quiverTime: number; bagTime: number };
  projectile: ProjectileDef;
}

// Placeholders, every one: how bows play is the user's to decide (AGENTS.md, "Bows").
export const BOW = {
  style: "ranged",
  ammo: "arrow",
  draw: { cost: 8, minTime: 0.25, fullTime: 1, minDamageShare: 0.3, moveFactor: 0.5 },
  nock: { quiverTime: 0.3, bagTime: 0.8 },
  projectile: {
    gravityMps2: -20, dragPerSec: 0.2, lifeTime: 3, stuckTime: 2, radiusM: 0.05, poiseDamage: 10, releaseUpM: 0.15,
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
  const share = drawnShare(moves, weapon, stats.strength, drawnTime), least = moves.draw.minDamageShare;
  return physicalDamage(weapon.damage * (least + (1 - least) * share), stats);
}

export function drawnPower(moves: RangedMoves, weapon: Weapon, strength: number, drawnTime: number): number {
  const share = drawnShare(moves, weapon, strength, drawnTime);
  return (share * share + 2 * share) / 3;
}

export function loosedSpeed(moves: RangedMoves, weapon: Weapon, strength: number, drawnTime: number): number {
  return (weapon.powerMps ?? 0) * drawnPower(moves, weapon, strength, drawnTime);
}

export function flightAfter(def: ProjectileDef, pos: Vec3, vel: Vec3, time: number): { pos: Vec3; vel: Vec3 } {
  const k = def.dragPerSec, g = def.gravityMps2, kept = Math.exp(-k * time), coastTime = -Math.expm1(-k * time) / k;
  const fallM = (g * (time - coastTime)) / k;
  return {
    pos: { x: pos.x + vel.x * coastTime, y: pos.y + vel.y * coastTime + fallM, z: pos.z + vel.z * coastTime },
    vel: { x: vel.x * kept, y: vel.y * kept + g * coastTime, z: vel.z * kept },
  };
}

export const nockTime = (moves: RangedMoves, quiver: Bag): number =>
  (bagCounts(quiver)[moves.ammo] ?? 0) > 0 ? moves.nock.quiverTime : moves.nock.bagTime;
