/** The player's stats, the same for everyone for now (so not saved), and what a new player starts with. */
import { blankSkillbook, emptyBag, PLAYER, starterEquipment, type Stats, type Vitals } from "@infinite-tower/shared";
import type { PlayerSave } from "../ports.js";

export const PLAYER_STATS: Stats = { stamina: 100, skillpower: 10, agility: 10, strength: 10 };

export const fullVitals = (stats: Stats): Vitals => ({ hp: PLAYER.maxHp, stamina: stats.stamina });

/** A player the store has never saved. */
export const newPlayer = (): PlayerSave => ({
  vitals: fullVitals(PLAYER_STATS), wins: 0, settings: {}, character: null, bag: emptyBag(), knownWords: [],
  equipment: starterEquipment(), skillbook: blankSkillbook(),
});
