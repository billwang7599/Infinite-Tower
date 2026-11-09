import type { Hand } from "../items/gear.js";
import type { Strike } from "./hybrid.js";
import { ITEM_IDS, itemDef, ITEMS, type ItemId } from "../items/items.js";

export type AttackKind = "light" | "heavy";

export const WEAPON_CLASSES = ["shortsword", "longsword", "greatsword", "bow"] as const;
export type WeaponClass = (typeof WEAPON_CLASSES)[number];
export type MeleeClass = Exclude<WeaponClass, "bow">;

export const DAMAGE_TYPES = ["slash", "stab", "blunt"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];
export type Damage = Record<DamageType, number>;

export const typedDamage = (amount: (type: DamageType) => number): Damage =>
  ({ slash: amount("slash"), stab: amount("stab"), blunt: amount("blunt") });
export const scaleDamage = (damage: Damage, factor: number): Damage => typedDamage((type) => damage[type] * factor);
export const damageTotal = (damage: Damage): number => damage.slash + damage.stab + damage.blunt;

/** One strike's row of a melee weapon's table. Times in s. */
export interface StrikeStats {
  windupTime: number;
  liveTime: number;
  recoverTime: number;
  /** Stamina, at the weapon's minimum strength. */
  cost: number;
  damage: Damage;
  poiseDamage: number;
}

/** What blocks: a blade, a bow's stave or a shield. A guard with a minimum strength raises quicker above it. */
export interface Guard {
  /** The blade (m), or a bow's stave: a swing's reach and a guard's perfect window grow with it. */
  length: number;
  raiseTime: number;
  minStrength?: number;
}

interface WeaponBase extends Guard {
  /** The grip strength (`appliedStrength`) it takes to hold it at all. */
  minStrength: number;
  /** Multiplies its damage only. */
  quality?: number;
}

/** Each weapon is a table of its own stats (the user: "every weapon just now has a table of stats to read from"). */
export interface MeleeWeapon extends WeaponBase {
  class: MeleeClass;
  strikes: Record<Strike, StrikeStats>;
  whiffRecoverTime: number;
  feintRecoverTime: number;
  /** How hard its swing meets another in a parry. */
  parryWeight: number;
}

export interface RangedWeapon extends WeaponBase {
  class: "bow";
  /** `cost` is paid as the draw starts; a release before `minTime` looses once it's reached. */
  draw: { minTime: number; fullTime: number; cost: number };
  /** The arrow's, fully drawn. */
  damage: Damage;
  /** The arrow's speed fully drawn. */
  powerMps: number;
}

export type Weapon = MeleeWeapon | RangedWeapon;

export const isMelee = (weapon: Weapon | null): weapon is MeleeWeapon => weapon !== null && weapon.class !== "bow";

const ofQuality = (weapon: Weapon, damage: Damage): Damage => scaleDamage(damage, weapon.quality ?? 1);

/** What it's shown to hit for: a melee weapon's light swing and its stab, a bow's arrow. */
export function weaponDamage(weapon: Weapon): Damage {
  if (!isMelee(weapon)) return ofQuality(weapon, weapon.damage);
  const { light, stab } = weapon.strikes;
  return ofQuality(weapon, { slash: light.damage.slash, blunt: light.damage.blunt, stab: stab.damage.stab });
}

type WeaponItems = {
  [K in ItemId as (typeof ITEMS)[K] extends { weapon: Weapon } ? K : never]:
    (typeof ITEMS)[K] extends { weapon: infer W extends Weapon } ? W : never
};
export type WeaponId = keyof WeaponItems;
export const WEAPONS = Object.fromEntries(ITEM_IDS.flatMap((id) => {
  const { weapon } = itemDef(id);
  return weapon ? [[id, weapon]] : [];
})) as WeaponItems;

export const isWeapon = (item: ItemId | null): item is WeaponId => item !== null && Object.hasOwn(WEAPONS, item);
export const canWield = (item: WeaponId, strength: number): boolean => strength >= WEAPONS[item].minStrength;
const TWO_HANDED: ReadonlySet<WeaponClass> = new Set(["bow"]);
export const twoHanded = (item: ItemId | null): boolean => isWeapon(item) && TWO_HANDED.has(WEAPONS[item].class);

/** Each point of grip strength over a weapon's minimum takes this share off its stamina costs, up to the cap. */
export const STRENGTH_DISCOUNT = { perPoint: 0.015, max: 0.5 } as const;
export const strengthDiscount = (weapon: Pick<Weapon, "minStrength">, strength: number): number =>
  1 - Math.min(STRENGTH_DISCOUNT.max, Math.max(0, strength - weapon.minStrength) * STRENGTH_DISCOUNT.perPoint);

/** Each point of grip strength over a weapon's minimum takes this share off all its times, up to the cap. */
export const STRENGTH_QUICKENING = { perPoint: 0.005, max: 0.08 } as const;
/** × every time of the weapon's; 1 for a guard with no minimum (a shield). */
export const strengthTimeFactor = (guard: Pick<Guard, "minStrength">, strength: number): number =>
  guard.minStrength === undefined ? 1
    : 1 - Math.min(STRENGTH_QUICKENING.max, Math.max(0, strength - guard.minStrength) * STRENGTH_QUICKENING.perPoint);

export type Hands = Record<Hand, ItemId | null> & { active?: Hand; oneHanded?: true };

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
