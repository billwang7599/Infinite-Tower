/**
 * Items: what each one is and does. Shared, since the inventory panel shows the same numbers the server applies.
 * Who drops what (and how often) is server content: server/src/core/content/drops.ts. The server keeps each player's
 * counts (`Inventory`) and is the only one that changes them.
 */

export interface ItemDef {
  name: string;
  description: string;
  /** Eating / drinking it restores this much HP (capped at max). Only on the field, not mid-fight. */
  healHp?: number;
  /** The use button's word. */
  verb?: string;
}

export const ITEMS = {
  "boar-meat": { name: "Boar meat", description: "Tough, but filling.", healHp: 35, verb: "Eat" },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

/** How many of each item a player has; an item they have none of is absent. */
export type Inventory = Partial<Record<ItemId, number>>;

export const itemDef = (id: ItemId): ItemDef => ITEMS[id];
