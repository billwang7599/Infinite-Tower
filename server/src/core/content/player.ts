import {
  BASE_BAG, blankSkillbook, coreStats, displacedBy, emptyBag, emptyEquipment, fitsSlot, ITEMS, keptCore, keptFaith,
  maxHpOf, newCore, packFor, shedUnwieldable, SLOTS, staminaMaxOf, stow, validateSkill, WORDS, type Bag, type BagItem,
  type Equipment, type ItemCounts, type ItemId, type Skill, type Skillbook, type Slot, type Stats, type Vitals,
  type Word,
} from "@infinite-tower/shared";
import { SkillSchema } from "@infinite-tower/shared/net/client-messages";
import { keptStory, newStory } from "../game/story.js";
import type { PlayerSave, StoredSave } from "../ports.js";
import { START_REGION } from "../world/index.js";
import { SHOPS, type ShopId } from "./shops.js";

export const PLAYER_STATS: Stats = coreStats(newCore());

export const fullVitals = (stats: Stats): Vitals => ({ hp: maxHpOf(stats), stamina: staminaMaxOf(stats) });

export const STARTER_BACKPACK = "canvas-backpack" satisfies ItemId;

/** A player the store has never saved. */
export const newPlayer = (): PlayerSave => ({
  vitals: fullVitals(PLAYER_STATS), settings: {}, character: null, bag: emptyBag(),
  pack: packFor(STARTER_BACKPACK), quiver: packFor(null), knownWords: [],
  equipment: { ...emptyEquipment(), back: STARTER_BACKPACK }, skillbook: blankSkillbook(), story: newStory(),
  pad: START_REGION, core: newCore(), shopsBought: [], faith: {},
});

const isItem = (item: string): item is ItemId => Object.hasOwn(ITEMS, item);

/**
 * What of a stored save still fits the game: words, items, quests and shops it no longer has are dropped. `spilled`:
 * what a grid of a size the game no longer has held that fits in neither grid now, for a pile at their feet.
 */
export function keptSave(stored: StoredSave): { save: PlayerSave; spilled: ItemCounts } {
  const knownWords = stored.knownWords.filter((word): word is Word => (WORDS as readonly string[]).includes(word));
  const core = keptCore(stored.core), refit = refitted(stored, wearable(stored.equipment));
  // Held under its minimum strength (a save from before the minimums): into the bag, or spilled.
  const shed = shedUnwieldable(refit, coreStats(core).strength), { bag, pack, quiver, equipment } = shed.gear;
  const spilled = { ...refit.spilled };
  for (const [item, count] of Object.entries(shed.spilled) as [ItemId, number][]) {
    spilled[item] = (spilled[item] ?? 0) + count;
  }
  const save = {
    ...stored, knownWords, bag, pack, quiver, equipment,
    skillbook: readable(stored.skillbook, new Set(knownWords)),
    story: keptStory(stored.story),
    core,
    shopsBought: stored.shopsBought.filter((shop): shop is ShopId => Object.hasOwn(SHOPS, shop)),
    faith: keptFaith(stored.faith),
  };
  return { save, spilled };
}

const sameSize = (a: Bag, b: Omit<Bag, "items">) => a.cols === b.cols && a.rows === b.rows
  && a.holds?.item === b.holds?.item && a.holds?.stackSize === b.holds?.stackSize;
const area = (s: BagItem) => ITEMS[s.item].cols * ITEMS[s.item].rows;

// A bag of another size is from before the backpack, so it gets the starter one. Biggest first packs tightest.
function refitted(saved: Pick<StoredSave, "bag" | "pack" | "quiver">, worn: Equipment) {
  const known = (grid: Bag) => grid.items.filter((s) => isItem(s.item));
  const oldBag = !sameSize(saved.bag, BASE_BAG);
  const equipment = { ...worn, back: worn.back ?? (oldBag ? STARTER_BACKPACK : null) };
  // A save from before bows took both hands: the left hand's goes into the bag.
  const loose = equipment.rightHand && displacedBy(equipment, equipment.rightHand, "rightHand");
  if (loose) equipment.leftHand = null;
  const grids = { bag: emptyBag(), pack: packFor(equipment.back), quiver: packFor(equipment.hip) };
  const old = { bag: oldBag, pack: !sameSize(saved.pack, grids.pack), quiver: !sameSize(saved.quiver, grids.quiver) };
  const kept = (grid: keyof typeof grids) => ({ ...grids[grid], items: old[grid] ? [] : known(saved[grid]) });
  let stowed = { bag: kept("bag"), pack: kept("pack"), quiver: kept("quiver") };
  const moved = (["bag", "pack", "quiver"] as const).flatMap((grid) => (old[grid] ? known(saved[grid]) : []));
  if (loose) moved.push({ item: loose, count: 1, x: 0, y: 0, turned: false });
  const spilled: ItemCounts = {};
  for (const s of moved.sort((a, b) => area(b) - area(a))) {
    const put = stow(stowed, s.item, s.count);
    stowed = put.gear;
    if (put.left > 0) spilled[s.item] = (spilled[s.item] ?? 0) + put.left;
  }
  return { ...stowed, equipment, spilled };
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
