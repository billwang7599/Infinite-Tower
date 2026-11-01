import { bagCounts, type Bag } from "./bag.js";
import type { ItemCounts } from "./items.js";

export const COINS = ["gold-coin", "silver-coin", "copper-coin"] as const;
export type CoinId = (typeof COINS)[number];

/** In copper. */
export const COIN_VALUE: Record<CoinId, number> = { "gold-coin": 10000, "silver-coin": 100, "copper-coin": 1 };

export const COIN_LETTER: Record<CoinId, string> = { "gold-coin": "g", "silver-coin": "s", "copper-coin": "c" };

export function coinsFor(copper: number): ItemCounts {
  const coins: ItemCounts = {};
  let left = copper;
  for (const coin of COINS) {
    const n = Math.floor(left / COIN_VALUE[coin]);
    if (n > 0) coins[coin] = n;
    left -= n * COIN_VALUE[coin];
  }
  return coins;
}

/** "1g 20s 5c". */
export function formatPrice(copper: number): string {
  const coins = coinsFor(copper);
  const parts = COINS.filter((coin) => coins[coin]).map((coin) => `${coins[coin]}${COIN_LETTER[coin]}`);
  return parts.length > 0 ? parts.join(" ") : "0c";
}

/** Changing coins goes one tier at a time: null between coins that aren't next to each other. */
export function exchangeRate(from: CoinId, to: CoinId): { give: number; get: number } | null {
  if (Math.abs(COINS.indexOf(from) - COINS.indexOf(to)) !== 1) return null;
  const rate = Math.max(COIN_VALUE[from], COIN_VALUE[to]) / Math.min(COIN_VALUE[from], COIN_VALUE[to]);
  return COIN_VALUE[from] > COIN_VALUE[to] ? { give: 1, get: rate } : { give: rate, get: 1 };
}

/** In copper. */
export function moneyIn(...grids: Bag[]): number {
  let copper = 0;
  for (const grid of grids) {
    const counts = bagCounts(grid);
    for (const coin of COINS) copper += (counts[coin] ?? 0) * COIN_VALUE[coin];
  }
  return copper;
}
