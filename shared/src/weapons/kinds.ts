import { itemDef } from "../items/items.js";
import { BOW, type RangedMoves } from "./bow.js";
import { wayShape, wayStepsAfter, type GuardKind } from "./hybrid.js";
import { isWeapon, WEAPONS, weaponIn, type Guard, type Hands, type Weapon, type WeaponKind } from "./weapons.js";

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

export function guardOf(hands: Hands): { kind: GuardKind; guard: Guard } | null {
  const shield = [hands.rightHand, hands.leftHand].flatMap((item) => (item && itemDef(item).shield) || [])[0];
  if (shield) return { kind: "shield", guard: shield };
  const weapon = weaponIn(hands);
  return weapon && { kind: dualWielding(hands) ? "dual" : "one", guard: weapon };
}
