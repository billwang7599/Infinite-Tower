import {
  blankSkillbook, coreStats, emptyBag, emptyEquipment, maxHpOf, newCore, staminaMaxOf, type Stats, type Vitals,
} from "@infinite-tower/shared";
import { newStory } from "../game/story.js";
import type { PlayerSave } from "../ports.js";
import { START_REGION } from "../world/index.js";

export const PLAYER_STATS: Stats = coreStats(newCore());

export const fullVitals = (stats: Stats): Vitals => ({ hp: maxHpOf(stats), stamina: staminaMaxOf(stats) });

/** A player the store has never saved. */
export const newPlayer = (): PlayerSave => ({
  vitals: fullVitals(PLAYER_STATS), wins: 0, settings: {}, character: null, bag: emptyBag(), knownWords: [],
  equipment: emptyEquipment(), skillbook: blankSkillbook(), story: newStory(), pad: START_REGION, core: newCore(),
  shopsBought: [], faith: {},
});
