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

export const HP_PER_VITALITY = 10;
export const STAMINA_PER_POINT = 15;
/** Damage taken × (DEFENSE_OFFSET + 10) / (DEFENSE_OFFSET + defense), so it never reaches 0. */
export const DEFENSE_OFFSET = 40;
/** HP a second = vitality × health regen / this. */
export const HP_REGEN_DIVISOR = 200;
export const HP_REGEN_PAUSE_TIME = 5;
/** In item weight (items/items.ts). */
export const CARRY_LIMIT_AT_AVERAGE = 60;
export const KNOCKBACK_TAKEN = { strengthPower: 0.25, steadinessPower: 0.5, min: 0.25, max: 2 } as const;

const ratio = (stat: number): number => stat / AVERAGE_STAT;
const takenFactor = (defense: number): number => (DEFENSE_OFFSET + AVERAGE_STAT) / (DEFENSE_OFFSET + defense);

export const physicalDamage = (base: number, stats: Stats): number => base * Math.sqrt(ratio(stats.strength));
export const skillDamage = (base: number, stats: Stats): number => base * Math.sqrt(ratio(stats.skillpower));
export const moveSpeed = (base: number, stats: Stats): number => base * ratio(stats.agility) ** 0.25;
export const maxHpOf = (stats: Stats): number => HP_PER_VITALITY * stats.vitality;
export const staminaMaxOf = (stats: Stats): number => STAMINA_PER_POINT * stats.stamina;
export const physicalTakenFactor = (stats: Stats): number => takenFactor(stats.defense);
export const skillTakenFactor = (stats: Stats): number => takenFactor(stats.specialDefense);
export const stunTime = (time: number, stats: Stats): number => time / ratio(stats.toughness);
export const staminaRegenPerSec = (stats: Stats, regenFactor: number): number =>
  PLAYER.staminaRegenPerSec * ratio(stats.staminaRecovery) * regenFactor;
export const hpRegenPerSec = (stats: Stats): number => (stats.vitality * stats.healthRegen) / HP_REGEN_DIVISOR;
export const carryLimit = (stats: Stats): number => CARRY_LIMIT_AT_AVERAGE * ratio(stats.strength) ** 0.25;
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
