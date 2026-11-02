import { AVERAGE_STAT } from "../battle/stats.js";
import type { Hand } from "../items/gear.js";
import type { ItemId } from "../items/items.js";

export type AttackKind = "light" | "heavy";

export const WEAPON_KINDS = ["sword"] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

export interface Weapon {
  kind: WeaponKind;
  /** The blade (m): every attack's reach grows with it. */
  length: number;
  damage: number;
  heft: number;
  minStrength: number;
}

export const WEAPONS = {
  "old-stick": { kind: "sword", length: 1, damage: 5, heft: 1, minStrength: 0 },
  sword: { kind: "sword", length: 1.1, damage: 9, heft: 1, minStrength: 0 },
  "kobold-blade": { kind: "sword", length: 1.1, damage: 14, heft: 1, minStrength: 0 },
  longsword: { kind: "sword", length: 1.4, damage: 11, heft: 1.2, minStrength: 6 },
  greatsword: { kind: "sword", length: 1.9, damage: 16, heft: 1.6, minStrength: 9 },
  "kobold-greatsword": { kind: "sword", length: 1.9, damage: 14, heft: 1.6, minStrength: 9 },
} as const satisfies Partial<Record<ItemId, Weapon>>;
export type WeaponId = keyof typeof WEAPONS;

export const isWeapon = (item: ItemId | null): item is WeaponId => item !== null && Object.hasOwn(WEAPONS, item);
export const canWield = (item: WeaponId, strength: number): boolean => strength >= WEAPONS[item].minStrength;
export const feltHeft = (weapon: Weapon, strength: number): number =>
  1 + (weapon.heft - 1) * (AVERAGE_STAT / strength);

/** The right hand's first. */
export const weaponItemIn = (hands: Record<Hand, ItemId | null>): WeaponId | null =>
  isWeapon(hands.rightHand) ? hands.rightHand : isWeapon(hands.leftHand) ? hands.leftHand : null;

export function weaponIn(hands: Record<Hand, ItemId | null>): Weapon | null {
  const item = weaponItemIn(hands);
  return item && WEAPONS[item];
}

export interface AttackSteps { driveAt: number; liveAt: number; liveUntil: number; endAt: number }

export interface HitShape { range: number; minDot: number }
