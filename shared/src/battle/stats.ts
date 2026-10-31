/**
 * Every fighter's stats, owned by the server (server/src/core/content/). Stamina is the bar's size; skillpower scales
 * skill damage, agility arena movement and strength a body blow's damage, each × stat / 10; strength also sets the
 * carry limit, and a weapon's damage by its fourth root (attackDamage). HP isn't a stat.
 */
import { defineComponent } from "../core/ecs.js";

export interface Stats {
  stamina: number;
  skillpower: number;
  agility: number;
  strength: number;
}

const AVERAGE = 10;

export const physicalDamage = (base: number, stats: Stats): number => (base * stats.strength) / AVERAGE;
export const skillDamage = (base: number, stats: Stats): number => (base * stats.skillpower) / AVERAGE;
export const moveSpeed = (base: number, stats: Stats): number => (base * stats.agility) / AVERAGE;

/** The carry limit, in item weight (items/items.ts). */
export const CARRY = { base: 30, perStrength: 3 } as const;
export const carryLimit = (stats: Stats): number => CARRY.base + CARRY.perStrength * stats.strength;

export const FighterStats = defineComponent<Stats>("FighterStats");
