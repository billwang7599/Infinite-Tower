/**
 * Every fighter's stats, owned by the server (server/src/core/content/). Stamina is the bar's size, mana the pool's
 * (no spells yet), spellpower scales spell damage; agility scales arena movement and strength physical damage and
 * the carry limit, each × stat / 10. HP isn't a stat.
 */
import { defineComponent } from "../core/ecs.js";

export interface Stats {
  stamina: number;
  mana: number;
  spellpower: number;
  agility: number;
  strength: number;
}

const AVERAGE = 10;

export const physicalDamage = (base: number, stats: Stats): number => (base * stats.strength) / AVERAGE;
export const moveSpeed = (base: number, stats: Stats): number => (base * stats.agility) / AVERAGE;

/** The carry limit, in item weight (items/items.ts). */
export const CARRY = { base: 30, perStrength: 3 } as const;
export const carryLimit = (stats: Stats): number => CARRY.base + CARRY.perStrength * stats.strength;

export const FighterStats = defineComponent<Stats>("FighterStats");
