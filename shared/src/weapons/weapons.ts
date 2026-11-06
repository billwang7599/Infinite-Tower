import { AVERAGE_STAT } from "../battle/stats.js";
import type { Hand } from "../items/gear.js";
import { ITEM_IDS, itemDef, ITEMS, type ItemId } from "../items/items.js";

export type AttackKind = "light" | "heavy";

export const WEAPON_KINDS = ["sword", "bow"] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

export const DAMAGE_TYPES = ["slash", "stab", "blunt"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];
export type Damage = Record<DamageType, number>;

export const typedDamage = (amount: (type: DamageType) => number): Damage =>
  ({ slash: amount("slash"), stab: amount("stab"), blunt: amount("blunt") });
export const scaleDamage = (damage: Damage, factor: number): Damage => typedDamage((type) => damage[type] * factor);
export const damageTotal = (damage: Damage): number => damage.slash + damage.stab + damage.blunt;

export const DAMAGE_PER_HEFT = 5;

export const DAMAGE_PROFILES = {
  sword: { slash: 0.9, blunt: 0.1, stab: 0.55 },
  longsword: { slash: 0.9, blunt: 0.1, stab: 0.7 },
  greatsword: { slash: 0.8, blunt: 0.2, stab: 0.4 },
  stick: { slash: 0, blunt: 1, stab: 1 / 3 },
  bow: { slash: 0, blunt: 0, stab: 1 },
} as const satisfies Record<string, Damage>;
export type DamageProfile = keyof typeof DAMAGE_PROFILES;

export interface Weapon {
  kind: WeaponKind;
  /** The blade (m), or a bow's stave: a swing's reach and a guard's perfect window grow with it. */
  length: number;
  heft: number;
  profile: DamageProfile;
  quality?: number;
  baseDamage?: number;
  /** A bow's: the arrow's speed fully drawn. */
  powerMps?: number;
}

export function weaponDamage(weapon: Weapon): Damage {
  const base = weapon.baseDamage ?? DAMAGE_PER_HEFT * weapon.heft * (weapon.quality ?? 1);
  return typedDamage((type) => Math.round(base * DAMAGE_PROFILES[weapon.profile][type]));
}

type WeaponItems = { [K in ItemId as (typeof ITEMS)[K] extends { weapon: Weapon } ? K : never]: Weapon };
export type WeaponId = keyof WeaponItems;
export const WEAPONS = Object.fromEntries(ITEM_IDS.flatMap((id) => {
  const { weapon } = itemDef(id);
  return weapon ? [[id, weapon]] : [];
})) as WeaponItems;

export const isWeapon = (item: ItemId | null): item is WeaponId => item !== null && Object.hasOwn(WEAPONS, item);
const TWO_HANDED: ReadonlySet<WeaponKind> = new Set(["bow"]);
export const twoHanded = (item: ItemId | null): boolean => isWeapon(item) && TWO_HANDED.has(WEAPONS[item].kind);
// However strong, a weapon never feels lighter than this share (all-in strength at Peak Tian reaches 0.75).
export const FELT_HEFT_FLOOR = 0.74;
export const strengthHeftFactor = (strength: number): number =>
  FELT_HEFT_FLOOR + (1 - FELT_HEFT_FLOOR) * AVERAGE_STAT / strength;
export const feltHeft = (weapon: Guard, strength: number): number =>
  (weapon.heft / WEAPONS.sword.heft) * strengthHeftFactor(strength);

export type Guard = Pick<Weapon, "length" | "heft">;

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
