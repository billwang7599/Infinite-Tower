/** The player's stats, the same for everyone for now (so not saved), and what a new player starts with. */
import {
  addItem, blankSkillbook, emptyBag, PLAYER, SLOTS, starterEquipment, WORDS, type ItemId, type Stats, type Vitals,
} from "@infinite-tower/shared";
import { newStory } from "../game/story.js";
import type { PlayerSave } from "../ports.js";

export const PLAYER_STATS: Stats = { stamina: 100, skillpower: 10, agility: 10, strength: 10 };

/** For now every player has these (and knows every word), and dying doesn't take them. */
export const STARTER_KIT: readonly ItemId[] = ["sword", "longsword", "greatsword", "skillbook"];

export const fullVitals = (stats: Stats): Vitals => ({ hp: PLAYER.maxHp, stamina: stats.stamina });

/** A player the store has never saved. */
export const newPlayer = (): PlayerSave => ({
  vitals: fullVitals(PLAYER_STATS), wins: 0, settings: {}, character: null, bag: emptyBag(), knownWords: [],
  equipment: starterEquipment(), skillbook: blankSkillbook(), story: newStory(), level: null,
});

export function withStarterKit(save: PlayerSave): PlayerSave {
  let bag = save.bag;
  for (const item of STARTER_KIT) {
    const carried = bag.items.some((s) => s.item === item) || SLOTS.some((slot) => save.equipment[slot] === item);
    if (!carried) bag = addItem(bag, item, 1).bag;
  }
  return { ...save, bag, knownWords: [...WORDS] };
}
