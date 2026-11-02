import type { ItemId } from "@infinite-tower/shared";

/** In copper. */
export const ITEM_VALUES: Partial<Record<ItemId, number>> = {
  "old-stick": 5, "boar-meat": 6, "boar-hide": 25, "boar-tusk": 40, "wolf-pelt": 30, "wolf-fang": 15,
  "lurker-scale": 20, bread: 4, "health-potion": 60, "stamina-tonic": 40,
  sword: 300, longsword: 900, greatsword: 1500,
};

/** By level; 1 where it's left out. Highmere, full of new avatars, charges more. */
export const PRICE_FACTOR: Partial<Record<string, number>> = { kingdom: 1.5, "market-ward": 1.5 };

export const SELL_SHARE = 0.4;
export const FIRST_PURCHASE_DISCOUNT = 0.25;

export type ShopId = "grocer" | "apothecary" | "smith" | "changer";

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
      "boar-hide", "boar-tusk", "wolf-pelt", "wolf-fang", "lurker-scale", "old-stick", "sword", "longsword",
      "greatsword",
    ],
  },
  changer: { name: "Money changer", sells: [], buys: [] },
};

export const SHOP_IDS = Object.keys(SHOPS) as ShopId[];
