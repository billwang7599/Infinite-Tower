/**
 * Each weapon class's base table (agent picks, plan/agent-picks.md): times in s, costs in stamina at the minimum
 * strength, damage before strength, momentum and quality. A weapon of a class spreads its base and overrides fields.
 */
import type { Guard, MeleeWeapon, RangedWeapon, StrikeStats, WeaponClass } from "./weapons.js";

const swing = (
  windupTime: number, liveTime: number, recoverTime: number, cost: number, slash: number, blunt: number,
  poiseDamage: number,
): StrikeStats => ({ windupTime, liveTime, recoverTime, cost, damage: { slash, stab: 0, blunt }, poiseDamage });

const thrust = (
  windupTime: number, liveTime: number, recoverTime: number, cost: number, stab: number, poiseDamage: number,
): StrikeStats => ({ windupTime, liveTime, recoverTime, cost, damage: { slash: 0, stab, blunt: 0 }, poiseDamage });

const SHORTSWORD: MeleeWeapon = {
  class: "shortsword", length: 1.1, minStrength: 8, raiseTime: 0.1,
  strikes: {
    light: swing(0.679, 0.13, 0.1, 13, 14, 2, 12),
    heavy: swing(1.109, 0.15, 0.263, 21, 28, 4, 24),
    stab: thrust(0.546, 0.13, 0.1, 16, 8, 18),
  },
  whiffRecoverTime: 0.2, feintRecoverTime: 0.38, parryWeight: 3,
};

const LONGSWORD: MeleeWeapon = {
  class: "longsword", length: 1.4, minStrength: 12, raiseTime: 0.14,
  strikes: {
    light: swing(0.768, 0.15, 0.12, 15, 16, 2, 15),
    heavy: swing(1.248, 0.18, 0.3, 24, 32, 4, 30),
    stab: thrust(0.6, 0.15, 0.11, 17, 13, 24),
  },
  whiffRecoverTime: 0.24, feintRecoverTime: 0.44, parryWeight: 3.6,
};

const GREATSWORD: MeleeWeapon = {
  class: "greatsword", length: 1.9, minStrength: 15, raiseTime: 0.24,
  strikes: {
    light: swing(1.2, 0.21, 0.19, 38, 28, 6, 20),
    heavy: swing(2.04, 0.24, 0.45, 60, 56, 12, 40),
    stab: thrust(0.9, 0.19, 0.15, 35, 10, 28),
  },
  whiffRecoverTime: 0.32, feintRecoverTime: 0.6, parryWeight: 4.9,
};

const BOW: RangedWeapon = {
  class: "bow", length: 1.2, minStrength: 0, raiseTime: 0.1,
  draw: { minTime: 0.25, fullTime: 1, cost: 8 },
  damage: { slash: 0, stab: 20, blunt: 0 }, powerMps: 60,
};

export const CLASS_TABLES = {
  shortsword: SHORTSWORD, longsword: LONGSWORD, greatsword: GREATSWORD, bow: BOW,
} as const satisfies Record<WeaponClass, MeleeWeapon | RangedWeapon>;

const blunt = (strike: StrikeStats, amount: number): StrikeStats =>
  ({ ...strike, damage: { slash: 0, stab: 0, blunt: amount } });

export const WOODEN_SWORD: MeleeWeapon = {
  ...SHORTSWORD, minStrength: 0,
  strikes: {
    light: blunt(SHORTSWORD.strikes.light, 3),
    heavy: blunt(SHORTSWORD.strikes.heavy, 6),
    stab: blunt(SHORTSWORD.strikes.stab, 2),
  },
};

export const WOODEN_SHIELD: Guard = { length: 1.1, raiseTime: 0.1 };
