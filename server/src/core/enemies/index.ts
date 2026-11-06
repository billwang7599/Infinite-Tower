import {
  essenceFactor, grownStats, itemDef, maxHpOf, type EnemyDef, type EnemyId, type ItemCounts, type ItemId, type Rarity,
} from "@infinite-tower/shared";
import type { Part } from "../overworld/parts.js";
import { BOG_LURKER } from "./bog-lurker.js";
import { BRAM } from "./bram.js";
import { CHICKEN } from "./chicken.js";
import { GOBLIN_WARLOCK } from "./goblin-warlock.js";
import { GREY_WOLF } from "./grey-wolf.js";
import { KOBOLD_GREATSWORD } from "./kobold-greatsword.js";
import { KOBOLD_SHIELDBEARER } from "./kobold-shieldbearer.js";
import { KOBOLD_SWORDSMAN } from "./kobold-swordsman.js";
import { TRAINING_DUMMY } from "./training-dummy.js";
import { WILD_BOAR } from "./wild-boar.js";

export interface Enemy {
  def: EnemyDef;
  /** Each rolled on its own. */
  drops: { item: ItemId; chance: number; count: number }[];
  treasure: Partial<Record<TreasureTier, number>>;
  /** Its overworld actor's behaviors, made fresh for each spawn. */
  overworld: () => Part[];
}

// Commonest first, as their bands lie on a kill's roll.
export const TREASURE_TIERS = ["uncommon", "rare", "epic", "legendary", "unique"] as const satisfies Rarity[];
export type TreasureTier = (typeof TREASURE_TIERS)[number];

export const TREASURE: Record<TreasureTier, readonly ItemId[]> = {
  uncommon: ["sigil-of-grit"],
  rare: ["sigil-of-embers"],
  epic: ["sigil-of-the-last-breath"],
  legendary: ["sigil-of-the-red-blade"],
  unique: ["sigil-of-the-first-door"],
};

export const ENEMIES: Record<EnemyId, Enemy> = {
  "wild-boar": WILD_BOAR,
  "kobold-swordsman": KOBOLD_SWORDSMAN,
  "kobold-greatsword": KOBOLD_GREATSWORD,
  "kobold-shieldbearer": KOBOLD_SHIELDBEARER,
  "goblin-warlock": GOBLIN_WARLOCK,
  "grey-wolf": GREY_WOLF,
  "bog-lurker": BOG_LURKER,
  "training-dummy": TRAINING_DUMMY,
  bram: BRAM,
  chicken: CHICKEN,
};

export function enemyAt(id: EnemyId, steps: number): EnemyDef {
  const { def } = ENEMIES[id];
  if (steps === 0) return def;
  const stats = grownStats(def.stats, steps);
  return { ...def, stats, maxHp: maxHpOf(stats, def.maxHp), steps };
}

const isEssence = (item: ItemId): boolean =>
  (itemDef(item).consumable?.effects ?? []).some((effect) => "essence" in effect);

// A unique roll with none free drops nothing.
export function rollDrops(
  enemy: EnemyId, rng: () => number, isFree: (item: ItemId) => boolean, steps = 0,
): ItemCounts {
  const loot: ItemCounts = {}, { drops, treasure } = ENEMIES[enemy];
  for (const d of drops) {
    const count = d.count * (isEssence(d.item) ? essenceFactor(steps) : 1);
    if (rng() < d.chance) loot[d.item] = (loot[d.item] ?? 0) + count;
  }
  const tier = treasureTier(treasure, rng());
  if (tier) {
    const pool = TREASURE[tier].filter((item) => tier !== "unique" || isFree(item));
    const item = pool[Math.floor(rng() * pool.length)];
    if (item) loot[item] = (loot[item] ?? 0) + 1;
  }
  return loot;
}

function treasureTier(treasure: Enemy["treasure"], roll: number): TreasureTier | null {
  let below = 0;
  for (const tier of TREASURE_TIERS) {
    below += treasure[tier] ?? 0;
    if (roll < below) return tier;
  }
  return null;
}
