/** What enemies drop when you beat them. Each entry is rolled on its own. */
import { MAX_STACK, type Inventory, type ItemId } from "@infinite-tower/shared";
import type { EnemyId } from "./enemies.js";

interface DropDef {
  item: ItemId;
  chance: number;
  count: number;
}

export const DROPS: Record<EnemyId, DropDef[]> = {
  "wild-boar": [{ item: "boar-meat", chance: 0.6, count: 1 }],
};

export function rollDrops(enemy: EnemyId, rng: () => number): Inventory {
  const loot: Inventory = {};
  for (const d of DROPS[enemy]) if (rng() < d.chance) loot[d.item] = (loot[d.item] ?? 0) + d.count;
  return loot;
}

/** `into` plus `loot`, each item capped at MAX_STACK. */
export function addItems(into: Inventory, loot: Inventory): Inventory {
  const next = { ...into };
  for (const [id, n] of Object.entries(loot) as [ItemId, number][]) next[id] = Math.min(MAX_STACK, (next[id] ?? 0) + n);
  return next;
}
