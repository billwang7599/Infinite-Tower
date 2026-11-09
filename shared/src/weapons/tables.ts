/**
 * Every weapon's own table (agent picks, plan/agent-picks.md): times in s, costs in stamina at the weapon's minimum
 * strength, damage before strength, momentum and quality. A heavy's damage is twice its light's.
 */
import type { Guard, MeleeWeapon, RangedWeapon, StrikeStats } from "./weapons.js";

const swing = (
  windupTime: number, liveTime: number, recoverTime: number, cost: number, slash: number, blunt: number,
  poiseDamage: number,
): StrikeStats => ({ windupTime, liveTime, recoverTime, cost, damage: { slash, stab: 0, blunt }, poiseDamage });

const thrust = (
  windupTime: number, liveTime: number, recoverTime: number, cost: number, stab: number, poiseDamage: number,
): StrikeStats => ({ windupTime, liveTime, recoverTime, cost, damage: { slash: 0, stab, blunt: 0 }, poiseDamage });

/** Quick, cheap and feeble: no edge, a poke for a stab. */
export const OLD_STICK: MeleeWeapon = {
  kind: "sword", length: 1, minStrength: 0, raiseTime: 0.08,
  strikes: {
    light: swing(0.46, 0.11, 0.08, 7, 0, 3, 6),
    heavy: swing(0.78, 0.13, 0.2, 12, 0, 6, 12),
    stab: thrust(0.44, 0.11, 0.08, 9, 1, 8),
  },
  whiffRecoverTime: 0.14, feintRecoverTime: 0.3, parryWeight: 1,
};

/** The measure the others are set against: at a new player's grip (10), on the steps it had before tables. */
export const BASIC_SWORD: MeleeWeapon = {
  kind: "sword", length: 1.1, minStrength: 8, raiseTime: 0.1,
  strikes: {
    light: swing(0.566, 0.13, 0.1, 13, 14, 2, 12),
    heavy: swing(0.924, 0.15, 0.263, 21, 28, 4, 24),
    stab: thrust(0.455, 0.13, 0.1, 16, 8, 18),
  },
  whiffRecoverTime: 0.2, feintRecoverTime: 0.38, parryWeight: 3,
};

/** Balanced reach, and the thrusting sword. */
export const LONGSWORD: MeleeWeapon = {
  kind: "sword", length: 1.4, minStrength: 12, raiseTime: 0.14,
  strikes: {
    light: swing(0.64, 0.15, 0.12, 15, 16, 2, 15),
    heavy: swing(1.04, 0.18, 0.3, 24, 32, 4, 30),
    stab: thrust(0.5, 0.15, 0.11, 17, 13, 24),
  },
  whiffRecoverTime: 0.24, feintRecoverTime: 0.44, parryWeight: 3.6,
};

/** Slow to start and slow to recover, long in reach, and it breaks poise. */
export const GREATSWORD: MeleeWeapon = {
  kind: "sword", length: 1.9, minStrength: 15, raiseTime: 0.24,
  strikes: {
    light: swing(0.95, 0.21, 0.16, 21, 20, 5, 20),
    heavy: swing(1.55, 0.24, 0.42, 34, 40, 10, 40),
    stab: thrust(0.75, 0.19, 0.15, 26, 10, 28),
  },
  whiffRecoverTime: 0.32, feintRecoverTime: 0.6, parryWeight: 4.9,
};

export const WOODEN_SHIELD: Guard = { length: 1.1, raiseTime: 0.1 };

export const TRAINING_BOW: RangedWeapon = {
  kind: "bow", length: 1.2, minStrength: 0, raiseTime: 0.1,
  draw: { minTime: 0.25, fullTime: 1, cost: 8 },
  damage: { slash: 0, stab: 20, blunt: 0 }, powerMps: 60,
};
