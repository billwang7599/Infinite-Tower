/**
 * The player: their stats (shared/src/battle/stats.ts says what each does) and what a new player starts with.
 * Everyone has the same stats for now; when they can change (levels, gear), they become part of the player's save.
 */
import { PLAYER, type Stats, type Vitals } from "@infinite-tower/shared";
import type { PlayerSave } from "../ports.js";

export const PLAYER_STATS: Stats = { stamina: 100, mana: 50, spellpower: 10, agility: 10, strength: 10 };

/** Full HP and stamina: after resting, losing a battle, or for a new player. */
export const fullVitals = (stats: Stats): Vitals => ({ hp: PLAYER.maxHp, stamina: stats.stamina });

/** A player the store has never saved. */
export const newPlayer = (): PlayerSave => ({
  vitals: fullVitals(PLAYER_STATS), wins: 0, settings: {}, character: null, inventory: {},
});
