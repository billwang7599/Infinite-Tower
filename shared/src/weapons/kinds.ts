import { itemDef } from "../items/items.js";
import { BOW, type RangedMoves } from "./bow.js";
import { wayShape, wayStepsAfter, type GuardKind } from "./hybrid.js";
import {
  isWeapon, WEAPONS, weaponHandIn, weaponIn, type Guard, type Hands, type Weapon, type WeaponKind,
} from "./weapons.js";

export interface MeleeMoves {
  style: "melee";
  shape: typeof wayShape;
  steps: typeof wayStepsAfter;
}

export type WeaponMoves = MeleeMoves | RangedMoves;
export type WeaponStyle = WeaponMoves["style"];

export const MOVES: Record<WeaponKind, WeaponMoves> = {
  sword: { style: "melee", shape: wayShape, steps: wayStepsAfter },
  bow: BOW,
};

export const movesOf = (weapon: Weapon): WeaponMoves => MOVES[weapon.kind];

export function meleeOf(weapon: Weapon | null): MeleeMoves | null {
  const moves = weapon && movesOf(weapon);
  return moves?.style === "melee" ? moves : null;
}

export function rangedOf(weapon: Weapon | null): RangedMoves | null {
  const moves = weapon && movesOf(weapon);
  return moves?.style === "ranged" ? moves : null;
}

export const meleeIn = (hands: Hands): Weapon | null => {
  const weapon = weaponIn(hands);
  return meleeOf(weapon) ? weapon : null;
};

export const dualWielding = ({ rightHand, leftHand }: Hands): boolean =>
  isWeapon(rightHand) && isWeapon(leftHand) && !!meleeOf(WEAPONS[rightHand]) && !!meleeOf(WEAPONS[leftHand]);

export type Grip = GuardKind | "two";

const shieldIn = (hands: Hands): Guard | null =>
  [hands.rightHand, hands.leftHand].flatMap((item) => (item && itemDef(item).shield) || [])[0] ?? null;

export function gripOf(hands: Hands): Grip | null {
  if (shieldIn(hands)) return "shield";
  const hand = weaponHandIn(hands);
  if (!hand) return null;
  if (dualWielding(hands)) return "dual";
  return meleeIn(hands) && !hands.oneHanded && !hands[hand === "rightHand" ? "leftHand" : "rightHand"] ? "two" : "one";
}

export const TWO_HAND_STRENGTH_FACTOR = 2;

export const appliedStrength = (hands: Hands, strength: number): number =>
  gripOf(hands) === "two" ? strength * TWO_HAND_STRENGTH_FACTOR : strength;

export function guardOf(hands: Hands): { kind: GuardKind; guard: Guard } | null {
  const grip = gripOf(hands), guard = shieldIn(hands) ?? weaponIn(hands);
  return grip && guard && { kind: grip === "two" ? "one" : grip, guard };
}
