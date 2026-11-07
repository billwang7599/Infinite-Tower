/** What each item is and does. Who drops what is in each enemy's server file (server/src/core/enemies/). */
import type { InscriptionId } from "../soul/inscriptions.js";
import type { Weapon } from "../weapons/weapons.js";

export type WornOn = "hand" | "cap" | "head" | "body" | "legs" | "boots" | "belt" | "back" | "finger" | "wrist";

export type ItemEffect = { healShare: number } | { staminaShare: number } | { essence: number };

export interface Consumable {
  verb: string;
  useTime: number;
  effects: readonly ItemEffect[];
}

export interface Wearable {
  on: WornOn;
  verb?: string;
  /** Worn in the cosmetic slot over `on`: a look only, never stats. */
  cosmetic?: boolean;
}

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "unique"] as const;
export type Rarity = (typeof RARITIES)[number];

export interface ItemDef {
  name: string;
  rarity: Rarity;
  description: string;
  /** Bag cells it covers, lying flat. */
  cols: number;
  rows: number;
  /** More than one only for single-cell items. */
  stackSize: number;
  weight: number;
  consumable?: Consumable;
  wearable?: Wearable;
  inscription?: InscriptionId;
  weapon?: Weapon;
  /** A backpack: the grid of its own it brings, worn. */
  pack?: { cols: number; rows: number };
}

const ABSORB_TIME = 2;

const coin = (name: string, description: string, weight: number) =>
  ({ name, rarity: "common", description, cols: 1, rows: 1, stackSize: 100, weight } as const);

const drink = <const Effect extends ItemEffect>(name: string, description: string, effect: Effect) => ({
  name, rarity: "uncommon" as Rarity, description, cols: 1, rows: 1, stackSize: 5, weight: 0.4,
  consumable: { verb: "Drink", useTime: 1, effects: [effect] as const },
});

const essence = <const Worth extends number>(
  name: string, rarity: Rarity, description: string, worth: Worth,
) => ({
  name, rarity, description, cols: 1, rows: 1, stackSize: 10, weight: 0.1,
  consumable: { verb: "Absorb", useTime: ABSORB_TIME, effects: [{ essence: worth }] as const },
});

const sigil = (name: string, rarity: Rarity, description: string, inscription: InscriptionId) =>
  ({ name, rarity, description, cols: 1, rows: 1, stackSize: 1, weight: 0.1, inscription });

export const ITEMS = {
  "boar-meat": {
    name: "Boar meat", rarity: "common", description: "Tough, but filling.", cols: 1, rows: 1, stackSize: 5,
    weight: 0.5, consumable: { verb: "Eat", useTime: 1, effects: [{ healShare: 0.35 }] },
  },
  bread: {
    name: "Bread", rarity: "common", description: "A round loaf from a Highmere oven.", cols: 1, rows: 1, stackSize: 5,
    weight: 0.3, consumable: { verb: "Eat", useTime: 1, effects: [{ healShare: 0.2 }] },
  },
  "health-potion": drink("Health potion", "Red, thick and bitter.", { healShare: 0.5 }),
  "stamina-tonic": drink("Stamina tonic", "Green, and it fizzes.", { staminaShare: 1 }),
  "copper-coin": coin("Copper coin", "A hundred make a silver.", 0.01),
  "silver-coin": coin("Silver coin", "A hundred make a gold.", 0.01),
  "gold-coin": coin("Gold coin", "Stamped with Highmere's castle.", 0.02),
  "boar-essence": essence("Boar essence", "common", "A warm ember of a boar's soul.", 20),
  "kobold-swordsman-essence": essence(
    "Kobold swordsman essence", "uncommon", "A quick, sharp spark of a kobold's soul.", 40,
  ),
  "kobold-greatsword-essence": essence(
    "Kobold greatsword essence", "uncommon", "A heavy, smouldering spark of a kobold's soul.", 50,
  ),
  "goblin-warlock-essence": essence("Goblin warlock essence", "uncommon", "A flickering wisp of a goblin's soul.", 30),
  "grey-wolf-essence": essence("Grey wolf essence", "uncommon", "A cold, restless flicker of a wolf's soul.", 25),
  "bog-lurker-essence": essence("Bog lurker essence", "uncommon", "A slow, heavy murk of a lurker's soul.", 45),
  "boar-hide": {
    name: "Boar hide", rarity: "common", description: "A stiff, bristly pelt. Bulky, but light.", cols: 2, rows: 2,
    stackSize: 1, weight: 2,
  },
  "boar-tusk": {
    name: "Boar tusk", rarity: "common", description: "Dense and curved. Heavier than it looks.", cols: 1, rows: 2,
    stackSize: 1, weight: 5,
  },
  "wolf-pelt": {
    name: "Wolf pelt", rarity: "common", description: "Thick grey fur, soft underneath. Bulky, but light.", cols: 2,
    rows: 2, stackSize: 1, weight: 1.5,
  },
  "wolf-fang": {
    name: "Wolf fang", rarity: "common", description: "Small, curved and still sharp.", cols: 1, rows: 1,
    stackSize: 10, weight: 0.1,
  },
  "lurker-scale": {
    name: "Lurker scale", rarity: "uncommon",
    description: "A thick plate of green-black scale, still slick with bog water.", cols: 1, rows: 1, stackSize: 10,
    weight: 0.4,
  },
  "bog-pearl": {
    name: "Bog pearl", rarity: "rare", description: "Grown in a lurker's gut, round and faintly green.", cols: 1,
    rows: 1, stackSize: 10, weight: 0.1,
  },
  "old-stick": {
    name: "Old stick", rarity: "common",
    description: "A length of ash, worn smooth by old hands. It's no blade, but it swings like one.",
    cols: 1, rows: 2, stackSize: 1, weight: 1, wearable: { on: "hand" },
    weapon: { kind: "sword", length: 1, damage: 5, heft: 1, minStrength: 0 },
  },
  sword: {
    name: "Sword", rarity: "common",
    description: "A plain straight blade. Quick to swing, and it guards as well as any.", cols: 1,
    rows: 3, stackSize: 1, weight: 3, wearable: { on: "hand" },
    weapon: { kind: "sword", length: 1.1, damage: 9, heft: 1, minStrength: 0 },
  },
  "kobold-blade": {
    name: "Kobold blade", rarity: "uncommon",
    description: "A notched blade, heavier at the tip. Kobolds don't let go of theirs.", cols: 1,
    rows: 3, stackSize: 1, weight: 3, wearable: { on: "hand" },
    weapon: { kind: "sword", length: 1.1, damage: 14, heft: 1, minStrength: 0 },
  },
  longsword: {
    name: "Longsword", rarity: "uncommon", description: "A longer, heavier blade. Slower to swing, and it hits harder.",
    cols: 1, rows: 3, stackSize: 1, weight: 4.5, wearable: { on: "hand" },
    weapon: { kind: "sword", length: 1.4, damage: 11, heft: 1.2, minStrength: 6 },
  },
  greatsword: {
    name: "Greatsword", rarity: "uncommon",
    description: "Taller than a kobold. Slow to swing, but it lands like a door.", cols: 1, rows: 4, stackSize: 1,
    weight: 8, wearable: { on: "hand" },
    weapon: { kind: "sword", length: 1.9, damage: 16, heft: 1.6, minStrength: 9 },
  },
  "kobold-greatsword": {
    name: "Kobold greatsword", rarity: "uncommon",
    description: "A slab of iron with a handle. Kobolds don't let go of theirs either.",
    cols: 1, rows: 4, stackSize: 1, weight: 8, wearable: { on: "hand" },
    weapon: { kind: "sword", length: 1.9, damage: 14, heft: 1.6, minStrength: 9 },
  },
  skillbook: {
    name: "Skillbook", rarity: "common",
    description: "A worn book of four pages. You need it in hand to use skills, and to write in it.",
    cols: 2, rows: 2, stackSize: 1, weight: 1.5, wearable: { on: "hand", verb: "Open" },
  },
  "canvas-backpack": {
    name: "Canvas backpack", rarity: "common",
    description: "A plain canvas sack on two straps. Worn on your back, it holds a grid of its own.", cols: 2,
    rows: 2, stackSize: 1, weight: 1, wearable: { on: "back" }, pack: { cols: 4, rows: 4 },
  },
  "wool-cap": {
    name: "Wool cap", rarity: "common", description: "A soft grey cap. It keeps the drizzle off.", cols: 2, rows: 1,
    stackSize: 1, weight: 0.2, wearable: { on: "cap" },
  },
  "leather-belt": {
    name: "Leather belt", rarity: "common", description: "A plain strap with an iron buckle.", cols: 2, rows: 1,
    stackSize: 1, weight: 0.4, wearable: { on: "belt" },
  },
  "copper-ring": {
    name: "Copper ring", rarity: "common", description: "A thin band that leaves a green mark.", cols: 1, rows: 1,
    stackSize: 1, weight: 0.05, wearable: { on: "finger" },
  },
  "braided-bracelet": {
    name: "Braided bracelet", rarity: "common", description: "Three leather cords, plaited tight round the wrist.",
    cols: 1, rows: 1, stackSize: 1, weight: 0.05, wearable: { on: "wrist" },
  },
  "feathered-hat": {
    name: "Feathered hat", rarity: "uncommon",
    description: "A wide red hat with a long plume. Worn over your cap, it changes only how you look.", cols: 2,
    rows: 1, stackSize: 1, weight: 0.3, wearable: { on: "cap", cosmetic: true },
  },
  "sigil-of-grit": sigil(
    "Sigil of Grit", "uncommon", "A clenched fist, cut in grey stone. Carved into a core, it makes you stronger.",
    "grit",
  ),
  "sigil-of-embers": sigil(
    "Sigil of Embers", "rare", "Warm to the touch. Carved into a core, it keeps you burning.", "embers",
  ),
  "sigil-of-the-last-breath": sigil(
    "Sigil of the Last Breath", "epic", "Carved into a core, it lets you swing and dodge on empty, paid for in blood.",
    "last-breath",
  ),
  "sigil-of-the-red-blade": sigil(
    "Sigil of the Red Blade", "legendary", "Carved into a core, every cut of your blade mends you a little.",
    "red-blade",
  ),
  "sigil-of-the-first-door": sigil(
    "Sigil of the First Door", "unique", "There's only one. It hums like the platform in Highmere's hall.",
    "first-door",
  ),
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

/** An item there's none of is absent. */
export type ItemCounts = Partial<Record<ItemId, number>>;

export const itemDef = (id: ItemId): ItemDef => ITEMS[id];

export const UNIQUE_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].rarity === "unique");
