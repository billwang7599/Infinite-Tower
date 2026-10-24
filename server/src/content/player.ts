/**
 * The player's stats (shared/src/battle/stats.ts says what each does). Everyone has the same ones for now; when
 * they can change (levels, gear), they become part of the player's save.
 */
import type { Stats } from "@infinite-tower/shared";

export const PLAYER_STATS: Stats = { stamina: 100, mana: 50, spellpower: 10, agility: 10, strength: 10 };
