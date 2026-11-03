import type { CarvePrice, ItemId, Rarity } from "@infinite-tower/shared";

/** In copper. */
export const ITEM_VALUES: Partial<Record<ItemId, number>> = {
  "old-stick": 5, "boar-meat": 6, "boar-hide": 25, "boar-tusk": 40, "wolf-pelt": 30, "wolf-fang": 15,
  "lurker-scale": 20, "bog-pearl": 250, bread: 4, "health-potion": 60, "stamina-tonic": 40,
  sword: 300, longsword: 900, greatsword: 1500,
};

/** By region; 1 where it's left out. Highmere, full of new avatars, charges more. */
export const PRICE_FACTOR: Partial<Record<string, number>> = { kingdom: 1.5, "market-ward": 1.5 };

export const SELL_SHARE = 0.4;
export const FIRST_PURCHASE_DISCOUNT = 0.25;

export type ShopId = "grocer" | "apothecary" | "smith" | "changer" | "collegium";

export interface Shop {
  name: string;
  sells: readonly ItemId[];
  buys: readonly ItemId[];
}

export const SHOPS: Record<ShopId, Shop> = {
  grocer: { name: "Food stall", sells: ["bread", "boar-meat"], buys: ["boar-meat", "bread"] },
  apothecary: { name: "Potion stall", sells: ["health-potion", "stamina-tonic"], buys: [] },
  smith: {
    name: "Forge", sells: ["sword", "longsword", "greatsword"],
    buys: [
      "boar-hide", "boar-tusk", "wolf-pelt", "wolf-fang", "lurker-scale", "bog-pearl", "old-stick", "sword",
      "longsword", "greatsword",
    ],
  },
  changer: { name: "Money changer", sells: [], buys: [] },
  collegium: { name: "Collegium of Thresholds", sells: [], buys: [] },
};

export const CARVING_SHOP: ShopId = "collegium";

/** Copper, and essences of any kind; the same in every place. */
export const CARVE_PRICES: Record<Rarity, CarvePrice> = {
  common: { copper: 50, essence: 1 },
  uncommon: { copper: 200, essence: 3 },
  rare: { copper: 1000, essence: 6 },
  epic: { copper: 4000, essence: 12 },
  legendary: { copper: 15000, essence: 25 },
  unique: { copper: 30000, essence: 40 },
};

export const REMOVE_PRICE_FACTOR = { copper: 3, essence: 2 } as const;
export const REMOVE_PRICES = Object.fromEntries(Object.entries(CARVE_PRICES).map(([rarity, { copper, essence }]) =>
  [rarity, { copper: copper * REMOVE_PRICE_FACTOR.copper, essence: essence * REMOVE_PRICE_FACTOR.essence }],
)) as Record<Rarity, CarvePrice>;
