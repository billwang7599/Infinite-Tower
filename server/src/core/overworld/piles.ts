import {
  addItem, ITEMS, PILE_LOOK_RAD, PILE_RANGE_M, pileInView, type Bag, type ItemCounts, type ItemId, type System,
  type Vec2,
} from "@infinite-tower/shared";
import { Pile } from "./components.js";

export const PILE_LIFETIME_MS = 10 * 60 * 1000;
export const PILE_COLS = 4;
/** Leeway on the reach and the look: the server's copy of you trails the client's. */
export const PILE_LAG_SLACK_M = 1;
export const PILE_LOOK_SLACK_RAD = (15 * Math.PI) / 180;

export const pileSeen = <P extends Vec2>(me: Vec2, way: Vec2, piles: readonly P[]): P | null =>
  pileInView(me, way, piles, PILE_RANGE_M + PILE_LAG_SLACK_M, PILE_LOOK_RAD + PILE_LOOK_SLACK_RAD);

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
