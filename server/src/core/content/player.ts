import {
  blankSkillbook, coreStats, emptyBag, emptyEquipment, fitsSlot, ITEMS, keptCore, keptFaith, maxHpOf, newCore, SLOTS,
  staminaMaxOf, validateSkill, WORDS, type Equipment, type ItemId, type Skill, type Skillbook, type Slot, type Stats,
  type Vitals, type Word,
} from "@infinite-tower/shared";
import { SkillSchema } from "@infinite-tower/shared/net/client-messages";
import { keptStory, newStory } from "../game/story.js";
import type { PlayerSave, StoredSave } from "../ports.js";
import { START_REGION } from "../world/index.js";
import { SHOPS, type ShopId } from "./shops.js";

export const PLAYER_STATS: Stats = coreStats(newCore());

export const fullVitals = (stats: Stats): Vitals => ({ hp: maxHpOf(stats), stamina: staminaMaxOf(stats) });

/** A player the store has never saved. */
export const newPlayer = (): PlayerSave => ({
  vitals: fullVitals(PLAYER_STATS), wins: 0, settings: {}, character: null, bag: emptyBag(), knownWords: [],
  equipment: emptyEquipment(), skillbook: blankSkillbook(), story: newStory(), pad: START_REGION, core: newCore(),
  shopsBought: [], faith: {},
});

const isItem = (item: string): item is ItemId => Object.hasOwn(ITEMS, item);

/** What of a stored save still fits the game: words, items, quests and shops it no longer has are dropped. */
export function keptSave(stored: StoredSave): PlayerSave {
  const knownWords = stored.knownWords.filter((word): word is Word => (WORDS as readonly string[]).includes(word));
  return {
    ...stored, knownWords,
    bag: { ...stored.bag, items: stored.bag.items.filter((s) => isItem(s.item)) },
    equipment: wearable(stored.equipment),
    skillbook: readable(stored.skillbook, new Set(knownWords)),
    story: keptStory(stored.story),
    core: keptCore(stored.core),
    shopsBought: stored.shopsBought.filter((shop): shop is ShopId => Object.hasOwn(SHOPS, shop)),
    faith: keptFaith(stored.faith),
  };
}

function readable(saved: unknown, known: ReadonlySet<Word>): Skillbook {
  const pages: readonly unknown[] = Array.isArray(saved) ? saved : [];
  return blankSkillbook().map((_, i) => {
    const page = SkillSchema.safeParse(pages[i]);
    return page.success && validateSkill(page.data, known).length === 0 ? page.data as Skill : null;
  });
}

function wearable(saved: Partial<Record<Slot, string | null>>): Equipment {
  const keep = (slot: Slot) => {
    const item = saved[slot];
    return item && isItem(item) && fitsSlot(item, slot) ? item : null;
  };
  return Object.fromEntries(SLOTS.map((slot) => [slot, keep(slot)])) as Equipment;
}
