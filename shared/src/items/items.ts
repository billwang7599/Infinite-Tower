/** What each item is and does. Who drops what is in each enemy's server file (server/src/core/enemies/). */

export type WornOn = "hand" | "head" | "body" | "legs" | "boots";

export type ItemEffect = { healHp: number };

export interface Consumable {
  verb: string;
  useTime: number;
  effects: readonly ItemEffect[];
}

export interface Wearable {
  on: WornOn;
  verb?: string;
}

export interface ItemDef {
  name: string;
  description: string;
  /** Bag cells it covers, lying flat. */
  cols: number;
  rows: number;
  /** More than one only for single-cell items. */
  stackSize: number;
  weight: number;
  consumable?: Consumable;
  wearable?: Wearable;
}

export const ITEMS = {
  "boar-meat": {
    name: "Boar meat", description: "Tough, but filling.", cols: 1, rows: 1, stackSize: 5, weight: 0.5,
    consumable: { verb: "Eat", useTime: 1, effects: [{ healHp: 35 }] },
  },
  "boar-hide": {
    name: "Boar hide", description: "A stiff, bristly pelt. Bulky, but light.", cols: 2, rows: 2, stackSize: 1,
    weight: 2,
  },
  "boar-tusk": {
    name: "Boar tusk", description: "Dense and curved. Heavier than it looks.", cols: 1, rows: 2, stackSize: 1,
    weight: 5,
  },
  sword: {
    name: "Sword", description: "A plain straight blade. You swing it with the mouse and stab with a click.", cols: 1,
    rows: 3, stackSize: 1, weight: 3, wearable: { on: "hand" },
  },
  "kobold-blade": {
    name: "Kobold blade", description: "A notched blade, heavier at the tip. Kobolds don't let go of theirs.", cols: 1,
    rows: 3, stackSize: 1, weight: 3, wearable: { on: "hand" },
  },
  longsword: {
    name: "Longsword", description: "A longer, heavier blade. Slower to get going, and it hits harder.", cols: 1,
    rows: 3, stackSize: 1, weight: 4.5, wearable: { on: "hand" },
  },
  greatsword: {
    name: "Greatsword", description: "Taller than a kobold. Slow to start and slow to turn, but it lands like a door.",
    cols: 1, rows: 4, stackSize: 1, weight: 8, wearable: { on: "hand" },
  },
  "kobold-greatsword": {
    name: "Kobold greatsword", description: "A slab of iron with a handle. Kobolds don't let go of theirs either.",
    cols: 1, rows: 4, stackSize: 1, weight: 8, wearable: { on: "hand" },
  },
  skillbook: {
    name: "Skillbook", description: "A worn book of four pages. You need it in hand to use skills, and to write in it.",
    cols: 2, rows: 2, stackSize: 1, weight: 1.5, wearable: { on: "hand", verb: "Open" },
  },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

/** An item there's none of is absent. */
export type ItemCounts = Partial<Record<ItemId, number>>;

export const itemDef = (id: ItemId): ItemDef => ITEMS[id];
