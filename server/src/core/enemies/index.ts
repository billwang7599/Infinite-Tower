import type { EnemyDef, EnemyId, ItemCounts, ItemId } from "@infinite-tower/shared";
import type { Part } from "../overworld/parts.js";
import { BRAM } from "./bram.js";
import { GOBLIN_WARLOCK } from "./goblin-warlock.js";
import { GREY_WOLF } from "./grey-wolf.js";
import { KOBOLD_GREATSWORD } from "./kobold-greatsword.js";
import { KOBOLD_SWORDSMAN } from "./kobold-swordsman.js";
import { TRAINING_DUMMY } from "./training-dummy.js";
import { WILD_BOAR } from "./wild-boar.js";

export interface Enemy {
  def: EnemyDef;
  /** Each rolled on its own. */
  drops: { item: ItemId; chance: number; count: number }[];
  /** Its overworld actor's behaviors, made fresh for each spawn. */
  overworld: () => Part[];
}

export const ENEMIES: Record<EnemyId, Enemy> = {
  "wild-boar": WILD_BOAR,
  "kobold-swordsman": KOBOLD_SWORDSMAN,
  "kobold-greatsword": KOBOLD_GREATSWORD,
  "goblin-warlock": GOBLIN_WARLOCK,
  "grey-wolf": GREY_WOLF,
  "training-dummy": TRAINING_DUMMY,
  bram: BRAM,
};

export function rollDrops(enemy: EnemyId, rng: () => number): ItemCounts {
  const loot: ItemCounts = {};
  for (const d of ENEMIES[enemy].drops) if (rng() < d.chance) loot[d.item] = (loot[d.item] ?? 0) + d.count;
  return loot;
}
