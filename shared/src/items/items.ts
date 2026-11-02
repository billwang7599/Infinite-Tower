/** What each item is and does. Who drops what is in each enemy's server file (server/src/core/enemies/). */

export type WornOn = "hand" | "head" | "body" | "legs" | "boots";

export type ItemEffect = { healShare: number } | { staminaShare: number } | { essence: number };

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

const ABSORB_TIME = 2;

const coin = (name: string, description: string, weight: number) =>
  ({ name, description, cols: 1, rows: 1, stackSize: 100, weight });

const drink = <const Effect extends ItemEffect>(name: string, description: string, effect: Effect) => ({
  name, description, cols: 1, rows: 1, stackSize: 5, weight: 0.4,
  consumable: { verb: "Drink", useTime: 1, effects: [effect] as const },
});

const essence = <const Worth extends number>(name: string, description: string, worth: Worth) => ({
  name, description, cols: 1, rows: 1, stackSize: 10, weight: 0.1,
  consumable: { verb: "Absorb", useTime: ABSORB_TIME, effects: [{ essence: worth }] as const },
});

export const ITEMS = {
  "boar-meat": {
    name: "Boar meat", description: "Tough, but filling.", cols: 1, rows: 1, stackSize: 5, weight: 0.5,
    consumable: { verb: "Eat", useTime: 1, effects: [{ healShare: 0.35 }] },
  },
  bread: {
    name: "Bread", description: "A round loaf from a Highmere oven.", cols: 1, rows: 1, stackSize: 5, weight: 0.3,
    consumable: { verb: "Eat", useTime: 1, effects: [{ healShare: 0.2 }] },
  },
  "health-potion": drink("Health potion", "Red, thick and bitter.", { healShare: 0.5 }),
  "stamina-tonic": drink("Stamina tonic", "Green, and it fizzes.", { staminaShare: 1 }),
  "copper-coin": coin("Copper coin", "A hundred make a silver.", 0.01),
  "silver-coin": coin("Silver coin", "A hundred make a gold.", 0.01),
  "gold-coin": coin("Gold coin", "Stamped with Highmere's castle.", 0.02),
  "boar-essence": essence("Boar essence", "A warm ember of a boar's soul.", 20),
  "kobold-swordsman-essence": essence("Kobold swordsman essence", "A quick, sharp spark of a kobold's soul.", 40),
  "kobold-greatsword-essence": essence(
    "Kobold greatsword essence", "A heavy, smouldering spark of a kobold's soul.", 50,
  ),
  "goblin-warlock-essence": essence("Goblin warlock essence", "A flickering wisp of a goblin's soul.", 30),
  "grey-wolf-essence": essence("Grey wolf essence", "A cold, restless flicker of a wolf's soul.", 25),
  "bog-lurker-essence": essence("Bog lurker essence", "A slow, heavy murk of a lurker's soul.", 45),
  "boar-hide": {
    name: "Boar hide", description: "A stiff, bristly pelt. Bulky, but light.", cols: 2, rows: 2, stackSize: 1,
    weight: 2,
  },
  "boar-tusk": {
    name: "Boar tusk", description: "Dense and curved. Heavier than it looks.", cols: 1, rows: 2, stackSize: 1,
    weight: 5,
  },
  "wolf-pelt": {
    name: "Wolf pelt", description: "Thick grey fur, soft underneath. Bulky, but light.", cols: 2, rows: 2,
    stackSize: 1, weight: 1.5,
  },
  "wolf-fang": {
    name: "Wolf fang", description: "Small, curved and still sharp.", cols: 1, rows: 1, stackSize: 10, weight: 0.1,
  },
  "lurker-scale": {
    name: "Lurker scale", description: "A thick plate of green-black scale, still slick with bog water.", cols: 1,
    rows: 1, stackSize: 10, weight: 0.4,
  },
  "old-stick": {
    name: "Old stick", description: "A length of ash, worn smooth by old hands. It's no blade, but it swings like one.",
    cols: 1, rows: 2, stackSize: 1, weight: 1, wearable: { on: "hand" },
  },
  sword: {
    name: "Sword", description: "A plain straight blade. Quick to swing, and it guards as well as any.", cols: 1,
    rows: 3, stackSize: 1, weight: 3, wearable: { on: "hand" },
  },
  "kobold-blade": {
    name: "Kobold blade", description: "A notched blade, heavier at the tip. Kobolds don't let go of theirs.", cols: 1,
    rows: 3, stackSize: 1, weight: 3, wearable: { on: "hand" },
  },
  longsword: {
    name: "Longsword", description: "A longer, heavier blade. Slower to swing, and it hits harder.", cols: 1,
    rows: 3, stackSize: 1, weight: 4.5, wearable: { on: "hand" },
  },
  greatsword: {
    name: "Greatsword", description: "Taller than a kobold. Slow to swing, but it lands like a door.",
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
