import type { EnemyDef, EnemyId, ItemCounts, ItemId } from "@infinite-tower/shared";
import type { Part } from "../overworld/parts.js";
import { GOBLIN_WARLOCK } from "./goblin-warlock.js";
import { KOBOLD_GREATSWORD } from "./kobold-greatsword.js";
import { KOBOLD_SWORDSMAN } from "./kobold-swordsman.js";
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
};

export const isEnemyId = (id: string): id is EnemyId => Object.hasOwn(ENEMIES, id);

export function rollDrops(enemy: EnemyId, rng: () => number): ItemCounts {
  const loot: ItemCounts = {};
  for (const d of ENEMIES[enemy].drops) if (rng() < d.chance) loot[d.item] = (loot[d.item] ?? 0) + d.count;
  return loot;
}
