/**
 * Every fighter's stats, players and monsters alike. The server owns them (enemy stats in
 * server/src/core/content/enemies.ts, the player's in server/src/core/content/player.ts) and sends them with each
 * encounter; the arena reads them from the `FighterStats` component. What each one does, for now:
 *
 *   stamina     the size of the stamina bar (points)
 *   mana        the size of the mana pool (points; nothing spends mana yet: there are no spells)
 *   spellpower  spell damage, as a multiplier like strength (no spells yet)
 *   agility     arena movement speed: walk speed × agility / 10
 *   strength    physical damage: an attack's damage × strength / 10; and how much a player can carry (`carryLimit`)
 *
 * 10 is "average" for the multiplier stats, so a fighter with 10 everywhere plays exactly as the base numbers say.
 * HP isn't a stat: it stays `PLAYER.maxHp` / `EnemyDef.maxHp`. Stats only apply in the arena, except through the
 * carry limit: an overloaded bag slows field walking too (items/burden.ts).
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

/** The carry limit (in item weight, items/items.ts): `base` for everyone, plus `perStrength` per point of strength. */
export const CARRY = { base: 30, perStrength: 3 } as const;
export const carryLimit = (stats: Stats): number => CARRY.base + CARRY.perStrength * stats.strength;

export const FighterStats = defineComponent<Stats>("FighterStats");
