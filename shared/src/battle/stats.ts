/**
 * Every fighter's stats and what they do. A player's come from their core (soul/core.ts), an enemy's from its file on
 * the server. At the average, 10, every formula gives the base number (×1).
 */
import { defineComponent } from "../core/ecs.js";
import { clamp } from "../core/math.js";
import { PLAYER, type Vitals } from "./player.js";

export const SHOWN_STATS = [
  "strength", "agility", "stamina", "skillpower", "vitality", "defense", "specialDefense",
] as const;
export const HIDDEN_STATS = ["toughness", "staminaRecovery", "healthRegen", "steadiness"] as const;
export const STAT_KEYS = [...SHOWN_STATS, ...HIDDEN_STATS] as const;

export type ShownStat = (typeof SHOWN_STATS)[number];
export type Stat = (typeof STAT_KEYS)[number];
export type Stats = Record<Stat, number>;

export const AVERAGE_STAT = 10;
export const BASE_STATS: Stats = Object.fromEntries(STAT_KEYS.map((stat) => [stat, AVERAGE_STAT])) as Stats;

export const BASE_HP = 100;
export const BASE_STAMINA = 100;
// Each effect goes × (stat / 10)^power. Damage's power is the bars' plus defense's, so equal stats take as many
// hits at every step.
export const STAT_POWERS = {
  damage: 1, bar: 0.5, defense: 0.5, blockStamina: 0.5, toughness: 0.5, staminaRecovery: 0.5, move: 0.25, carry: 0.25,
} as const;
export const HP_REGEN_SHARE_PER_SEC = 0.005;
export const HP_REGEN_PAUSE_TIME = 5;
/** In item weight (items/items.ts). */
export const CARRY_LIMIT_AT_AVERAGE = 60;
export const KNOCKBACK_TAKEN = { strengthPower: 0.25, steadinessPower: 0.5, min: 0.25, max: 2 } as const;

export const statFactor = (stat: number, power: keyof typeof STAT_POWERS): number =>
  (stat / AVERAGE_STAT) ** STAT_POWERS[power];
const ratio = (stat: number): number => stat / AVERAGE_STAT;

export const physicalDamage = (base: number, stats: Stats): number => base * statFactor(stats.strength, "damage");
export const skillDamage = (base: number, stats: Stats): number => base * statFactor(stats.skillpower, "damage");
export const moveSpeed = (base: number, stats: Stats): number => base * statFactor(stats.agility, "move");
/** `base`: an enemy's own HP at vitality 10. */
export const maxHpOf = (stats: Stats, base = BASE_HP): number => Math.round(base * statFactor(stats.vitality, "bar"));
export const staminaMaxOf = (stats: Stats): number => Math.round(BASE_STAMINA * statFactor(stats.stamina, "bar"));
export const physicalTakenFactor = (stats: Stats): number => 1 / statFactor(stats.defense, "defense");
export const skillTakenFactor = (stats: Stats): number => 1 / statFactor(stats.specialDefense, "defense");
export const stunTime = (time: number, stats: Stats): number => time / statFactor(stats.toughness, "toughness");
export const staminaRegenPerSec = (stats: Stats, regenFactor: number): number =>
  PLAYER.staminaRegenPerSec * statFactor(stats.staminaRecovery, "staminaRecovery") * regenFactor;
export const hpRegenPerSec = (stats: Stats): number =>
  maxHpOf(stats) * ratio(stats.healthRegen) * HP_REGEN_SHARE_PER_SEC;
export const carryLimit = (stats: Stats): number => CARRY_LIMIT_AT_AVERAGE * statFactor(stats.strength, "carry");
export const knockbackTakenFactor = (stats: Stats): number => {
  const { strengthPower, steadinessPower, min, max } = KNOCKBACK_TAKEN;
  return clamp(1 / (ratio(stats.strength) ** strengthPower * ratio(stats.steadiness) ** steadinessPower), min, max);
};

export function grownVitals(vitals: Vitals, before: Stats, after: Stats): Vitals {
  const grown = (value: number, was: number, most: number) => Math.min(most, value + Math.max(0, most - was));
  return {
    hp: grown(vitals.hp, maxHpOf(before), maxHpOf(after)),
    stamina: grown(vitals.stamina, staminaMaxOf(before), staminaMaxOf(after)),
  };
}

export const FighterStats = defineComponent<Stats>("FighterStats");
