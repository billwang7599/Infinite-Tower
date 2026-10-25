/** Changing what a player carries. Inventories are replaced, never changed in place (the session sends them). */
import type { Inventory, ItemId } from "@infinite-tower/shared";

/** Most of one item you can carry. */
export const MAX_STACK = 99;

/** `into` plus `loot`, each item capped at MAX_STACK. */
export function addItems(into: Inventory, loot: Inventory): Inventory {
  const next = { ...into };
  for (const [id, count] of Object.entries(loot) as [ItemId, number][]) {
    next[id] = Math.min(MAX_STACK, (next[id] ?? 0) + count);
  }
  return next;
}

/** `from` with one `item` fewer (gone once there are none left). */
export function removeOne(from: Inventory, item: ItemId): Inventory {
  const next = { ...from };
  const left = (next[item] ?? 0) - 1;
  if (left > 0) next[item] = left;
  else delete next[item];
  return next;
}
