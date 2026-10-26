/**
 * Items: what each one is and does, how much bag it takes up and what it weighs. Shared, since the bag screen shows
 * the same numbers the server applies. Who drops what (and how often) is server content:
 * server/src/core/content/drops.ts. Where a player's items sit is their bag (bag.ts), which only the server changes.
 */

export interface ItemDef {
  name: string;
  description: string;
  /** Bag cells it covers, lying flat: `cols` across, `rows` down. Turning it swaps them. */
  cols: number;
  rows: number;
  /** How many share one cell. More than one only for single-cell items. */
  stackSize: number;
  /** One item's weight. What you carry adds up against the carry limit (`carryLimit`, battle/stats.ts). */
  weight: number;
  /** Eating / drinking it restores this much HP (capped at max). Only on the field, not mid-fight. */
  healHp?: number;
  /** The use button's word. */
  verb?: string;
}

export const ITEMS = {
  "boar-meat": {
    name: "Boar meat", description: "Tough, but filling.", cols: 1, rows: 1, stackSize: 5, weight: 0.5, healHp: 35,
    verb: "Eat",
  },
  "boar-hide": {
    name: "Boar hide", description: "A stiff, bristly pelt. Bulky, but light.", cols: 2, rows: 2, stackSize: 1,
    weight: 2,
  },
  "boar-tusk": {
    name: "Boar tusk", description: "Dense and curved. Heavier than it looks.", cols: 1, rows: 2, stackSize: 1,
    weight: 5,
  },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

/** A count of each item, such as what an enemy dropped. An item there's none of is absent. */
export type ItemCounts = Partial<Record<ItemId, number>>;

export const itemDef = (id: ItemId): ItemDef => ITEMS[id];
