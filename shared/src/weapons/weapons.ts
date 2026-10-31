import { FIXED_DT } from "../core/time.js";
import type { Hand } from "../items/gear.js";
import type { ItemId } from "../items/items.js";

export const GUARD_SIDES = ["left", "top", "right"] as const;
export type GuardSide = (typeof GUARD_SIDES)[number];
export const ATTACK_KINDS = ["light", "heavy"] as const;
export type AttackKind = (typeof ATTACK_KINDS)[number];

const MIRRORED: Record<GuardSide, GuardSide> = { left: "right", top: "top", right: "left" };
/** Facing each other, one fighter's left is the other's right. */
export const mirrorSide = (side: GuardSide): GuardSide => MIRRORED[side];
export const blocks = (guard: GuardSide | null, attackFrom: GuardSide): boolean => guard === MIRRORED[attackFrom];

export const WEAPON_KINDS = ["sword"] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

export interface Weapon {
  kind: WeaponKind;
  /** The blade (m): every attack's reach grows with it. */
  length: number;
  damage: number;
  heft: number;
}

export const WEAPONS = {
  sword: { kind: "sword", length: 1.1, damage: 9, heft: 1 },
  "kobold-blade": { kind: "sword", length: 1.1, damage: 14, heft: 1 },
  longsword: { kind: "sword", length: 1.4, damage: 11, heft: 1.2 },
  greatsword: { kind: "sword", length: 1.9, damage: 16, heft: 1.6 },
  "kobold-greatsword": { kind: "sword", length: 1.9, damage: 14, heft: 1.6 },
} as const satisfies Partial<Record<ItemId, Weapon>>;
export type WeaponId = keyof typeof WEAPONS;

export const isWeapon = (item: ItemId | null): item is WeaponId => item !== null && Object.hasOwn(WEAPONS, item);

/** The right hand's first. */
export const weaponItemIn = (hands: Record<Hand, ItemId | null>): WeaponId | null =>
  isWeapon(hands.rightHand) ? hands.rightHand : isWeapon(hands.leftHand) ? hands.leftHand : null;

export function weaponIn(hands: Record<Hand, ItemId | null>): Weapon | null {
  const item = weaponItemIn(hands);
  return item && WEAPONS[item];
}

/**
 * Every attack's numbers, with a heft-1 weapon: seconds from the press to the blade going live (a chain's first, and
 * the ones after it), live, then recovering; stamina, damage (× the weapon's) and poise damage.
 */
export const ATTACKS = {
  light: {
    landTime: 0.45, chainLandTime: 0.4, liveTime: 0.1, recoverTime: 0.35, recoilTime: 0.3,
    cost: 12, damageFactor: 1, poiseDamage: 12,
  },
  heavy: {
    landTime: 0.85, chainLandTime: 0.7, liveTime: 0.12, recoverTime: 0.55, recoilTime: 0.5,
    cost: 20, damageFactor: 2, poiseDamage: 24,
  },
} as const;

export const COMBAT = {
  maxChain: 3,
  drawShare: 0.6,
  /** The attacker steps forward at this speed (m/s) while the blade is live, and walks at this share otherwise. */
  lungeSpeed: 4,
  moveFactor: 0.25,
  /** A guard covers attackers within this cosine of where its holder faces (0.34: 140°). */
  guardMinDot: 0.34,
  pushbackFactor: 0.6,
} as const;

export const ENEMY_GUARD = { minHoldTime: 1.5, maxHoldTime: 3, moveTime: 0.3 } as const;

const steps = (seconds: number): number => Math.round(seconds / FIXED_DT);

export interface AttackSteps { driveAt: number; liveAt: number; liveUntil: number; endAt: number }

export function attackSteps(weapon: Weapon, kind: AttackKind, chain: number, swift = 1): AttackSteps {
  const a = ATTACKS[kind], windup = ((chain > 0 ? a.chainLandTime : a.landTime) * weapon.heft) / swift;
  const liveAt = steps(windup), liveUntil = liveAt + steps(a.liveTime * weapon.heft);
  const endAt = liveUntil + steps(a.recoverTime * weapon.heft);
  return { driveAt: steps(windup * COMBAT.drawShare), liveAt, liveUntil, endAt };
}

const AVERAGE_STRENGTH = 10;
export const attackDamage = (weapon: Weapon, kind: AttackKind, strength: number): number =>
  weapon.damage * ATTACKS[kind].damageFactor * Math.sqrt(Math.sqrt(strength / AVERAGE_STRENGTH));
export const attackCost = (weapon: Weapon, kind: AttackKind): number => ATTACKS[kind].cost * weapon.heft;

const SHAPES: Record<GuardSide, { reachFactor: number; arcDeg: number }> = {
  left: { reachFactor: 1, arcDeg: 160 },
  top: { reachFactor: 1.3, arcDeg: 60 },
  right: { reachFactor: 1, arcDeg: 160 },
};

export interface HitShape { range: number; minDot: number }

export function attackShape(side: GuardSide, armReachM: number, weapon: Pick<Weapon, "length">): HitShape {
  const { reachFactor, arcDeg } = SHAPES[side];
  return { range: (armReachM + weapon.length) * reachFactor, minDot: Math.cos((arcDeg / 2) * (Math.PI / 180)) };
}
