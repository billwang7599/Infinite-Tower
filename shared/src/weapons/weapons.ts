import { AVERAGE_STAT } from "../battle/stats.js";
import type { Hand } from "../items/gear.js";
import { ITEM_IDS, itemDef, ITEMS, type ItemId } from "../items/items.js";

export type AttackKind = "light" | "heavy";

export const WEAPON_KINDS = ["sword", "bow"] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

export interface Weapon {
  kind: WeaponKind;
  /** The blade (m), or a bow's stave: a swing's reach and a guard's perfect window grow with it. */
  length: number;
  damage: number;
  heft: number;
  minStrength: number;
  /** A bow's: the arrow's speed fully drawn. */
  powerMps?: number;
}

type WeaponItems = { [K in ItemId as (typeof ITEMS)[K] extends { weapon: Weapon } ? K : never]: Weapon };
export type WeaponId = keyof WeaponItems;
export const WEAPONS = Object.fromEntries(ITEM_IDS.flatMap((id) => {
  const { weapon } = itemDef(id);
  return weapon ? [[id, weapon]] : [];
})) as WeaponItems;

export const isWeapon = (item: ItemId | null): item is WeaponId => item !== null && Object.hasOwn(WEAPONS, item);
export const canWield = (item: WeaponId, strength: number): boolean => strength >= WEAPONS[item].minStrength;
const TWO_HANDED: ReadonlySet<WeaponKind> = new Set(["bow"]);
export const twoHanded = (item: ItemId | null): boolean => isWeapon(item) && TWO_HANDED.has(WEAPONS[item].kind);
export const feltHeft = (weapon: Guard, strength: number): number =>
  weapon.heft < 1 ? weapon.heft : 1 + (weapon.heft - 1) * (AVERAGE_STAT / strength);

export type Guard = Pick<Weapon, "length" | "heft">;

export type Hands = Record<Hand, ItemId | null> & { active?: Hand };

export function weaponHandIn(hands: Hands): Hand | null {
  const first = hands.active ?? "rightHand", other = first === "rightHand" ? "leftHand" : "rightHand";
  return isWeapon(hands[first]) ? first : isWeapon(hands[other]) ? other : null;
}

export const weaponItemIn = (hands: Hands): WeaponId | null => {
  const hand = weaponHandIn(hands);
  return hand && (hands[hand] as WeaponId);
};

export function weaponIn(hands: Hands): Weapon | null {
  const item = weaponItemIn(hands);
  return item && WEAPONS[item];
}

export interface AttackSteps { driveAt: number; liveAt: number; liveUntil: number; endAt: number }

export interface HitShape { range: number; minDot: number }
