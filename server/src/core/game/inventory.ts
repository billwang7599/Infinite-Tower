/** Loot into a bag. The bag's own rules (fitting, stacking, moving) are shared: shared/src/items/bag.ts. */
import { addItem, type Bag, type ItemCounts, type ItemId } from "@infinite-tower/shared";

/** `loot` packed into `bag` where it fits (see `addItem`); `left` is what there was no room for. */
export function packLoot(bag: Bag, loot: ItemCounts): { bag: Bag; left: ItemCounts } {
  let packed = bag;
  const left: ItemCounts = {};
  for (const [item, count] of Object.entries(loot) as [ItemId, number][]) {
    const added = addItem(packed, item, count);
    packed = added.bag;
    if (added.left > 0) left[item] = added.left;
  }
  return { bag: packed, left };
}
