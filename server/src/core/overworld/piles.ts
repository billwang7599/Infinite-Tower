import { addItem, ITEMS, type Bag, type ItemCounts, type ItemId, type System } from "@infinite-tower/shared";
import { Pile } from "./components.js";

export const PILE_LIFETIME_MS = 10 * 60 * 1000;
export const PILE_COLS = 4;

/** Wider than PILE_COLS only for an item too big to fit turned. */
export function packPile(items: ItemCounts): Bag {
  const entries = Object.entries(items) as [ItemId, number][];
  const cols = Math.max(PILE_COLS, ...entries.map(([id]) => Math.min(ITEMS[id].cols, ITEMS[id].rows)));
  for (let rows = 1; ; rows++) {
    let bag: Bag = { cols, rows, items: [] };
    const fitAll = entries.every(([id, count]) => {
      const added = addItem(bag, id, count);
      bag = added.bag;
      return added.left === 0;
    });
    if (fitAll) return bag;
  }
}

export const pileSystem: System = (world) => {
  const nowMs = Date.now();
  for (const [e, pile] of world.query(Pile)) if (nowMs >= pile.vanishAtMs) world.destroy(e);
};
