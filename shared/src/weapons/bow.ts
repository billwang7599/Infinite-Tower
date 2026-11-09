import { physicalDamage, type Stats } from "../battle/stats.js";
import { clamp, type Vec3 } from "../core/math.js";
import { bagCounts, type Bag } from "../items/bag.js";
import type { AmmoId } from "../items/items.js";
import {
  strengthDiscount, strengthTimeFactor, typedDamage, weaponDamage, type Damage, type RangedWeapon,
} from "./weapons.js";

/** Lengths in m, speeds in m/s, times in s. `release*M`: where it leaves the bow, from the shooter's center. */
export interface ProjectileDef {
  gravityMps2: number;
  dragPerSec: number;
  lifeTime: number;
  /** In the floor or the wall, it lies this long before it's gone. */
  stuckTime: number;
  radiusM: number;
  poiseDamage: number;
  knockbackShare: number;
  releaseUpM: number;
  releaseOutM: number;
}

export interface RangedMoves {
  style: "ranged";
  ammo: AmmoId;
  /** Its times and cost are each bow's own (`RangedWeapon.draw`). */
  draw: { minDamageShare: number; moveFactor: number };
  /** After a loose, before the next draw can start: by where the next arrow comes from. */
  nock: { quiverTime: number; bagTime: number };
  projectile: ProjectileDef;
}

// Placeholders, every one: how bows play is the user's to decide (AGENTS.md, "Bows").
export const BOW = {
  style: "ranged",
  ammo: "arrow",
  draw: { minDamageShare: 0.3, moveFactor: 0.5 },
  nock: { quiverTime: 0.3, bagTime: 0.8 },
  projectile: {
    gravityMps2: -20, dragPerSec: 0.2, lifeTime: 3, stuckTime: 2, radiusM: 0.05, poiseDamage: 10, knockbackShare: 0.07,
    releaseUpM: 0.15, releaseOutM: 0.6,
  },
} as const satisfies RangedMoves;

/** The bow's own, quickened a little by strength over its minimum as a swing is. */
export const drawTime = (weapon: RangedWeapon, time: "minTime" | "fullTime", strength: number): number =>
  weapon.draw[time] * strengthTimeFactor(weapon, strength);

export const drawCost = (weapon: RangedWeapon, strength: number): number =>
  weapon.draw.cost * strengthDiscount(weapon, strength);

/** 0 just begun, 1 fully drawn. */
export const drawnShare = (weapon: RangedWeapon, drawnTime: number, strength: number): number =>
  clamp(drawnTime / drawTime(weapon, "fullTime", strength), 0, 1);

export function loosedDamage(moves: RangedMoves, weapon: RangedWeapon, drawnTime: number, stats: Stats): Damage {
  const share = drawnShare(weapon, drawnTime, stats.strength), least = moves.draw.minDamageShare;
  const arrow = weaponDamage(weapon);
  return typedDamage((type) => physicalDamage(arrow[type] * (least + (1 - least) * share), stats));
}

export function drawnPower(weapon: RangedWeapon, drawnTime: number, strength: number): number {
  const share = drawnShare(weapon, drawnTime, strength);
  return (share * share + 2 * share) / 3;
}

export function loosedSpeed(weapon: RangedWeapon, drawnTime: number, strength: number): number {
  return weapon.powerMps * drawnPower(weapon, drawnTime, strength);
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
