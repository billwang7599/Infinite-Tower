import {
  addItem, bagCounts, COIN_VALUE, COINS, coinsFor, exchangeRate, itemAt, takeItems, type CoinId, type Gear,
  type ItemCounts, type ItemId, type ShopView, type TradeNews, type UseSpot,
} from "@infinite-tower/shared";
import {
  CARVE_PRICES, CARVING_SHOP, FIRST_PURCHASE_DISCOUNT, ITEM_VALUES, PRICE_FACTOR, REMOVE_PRICES, SELL_SHARE, SHOPS,
  type ShopId,
} from "../content/shops.js";
import type { GameSession } from "./session.js";
import { shopInView } from "./talk.js";

export interface Trade { gear: Gear; onCloth: boolean }

const fullPrice = (item: ItemId, region: string) =>
  Math.round((ITEM_VALUES[item] ?? 0) * (PRICE_FACTOR[region] ?? 1));
const paidFor = (item: ItemId) => Math.floor((ITEM_VALUES[item] ?? 0) * SELL_SHARE);

export function shopView(id: ShopId, region: string, boughtThere: boolean): ShopView {
  const shop = SHOPS[id];
  const stock = shop.sells.map((item) => {
    const full = fullPrice(item, region);
    return { item, price: boughtThere ? full : Math.round(full * (1 - FIRST_PURCHASE_DISCOUNT)), fullPrice: full };
  });
  const buys = shop.buys.filter((item) => paidFor(item) > 0);
  const view: ShopView = {
    name: shop.name, stock, buys: Object.fromEntries(buys.map((item) => [item, paidFor(item)])),
  };
  if (id === CARVING_SHOP) view.carving = { carve: CARVE_PRICES, remove: REMOVE_PRICES };
  return view;
}

export function receive(gear: Gear, items: ItemCounts): Trade | null {
  let { bag, cloth } = gear, onCloth = false;
  for (const [item, count] of Object.entries(items) as [ItemId, number][]) {
    const packed = addItem(bag, item, count);
    bag = packed.bag;
    if (packed.left === 0) continue;
    const dropped = addItem(cloth, item, packed.left);
    if (dropped.left > 0) return null;
    cloth = dropped.bag;
    onCloth = true;
  }
  return { gear: { ...gear, bag, cloth }, onCloth };
}

/** Off the cloth first, then the bag. */
export function take(gear: Gear, item: ItemId, count: number): Gear | null {
  const fromCloth = Math.min(count, bagCounts(gear.cloth)[item] ?? 0);
  const cloth = takeItems(gear.cloth, item, fromCloth), bag = takeItems(gear.bag, item, count - fromCloth);
  return cloth && bag ? { ...gear, cloth, bag } : null;
}

/** Smallest coins first; if that's short, the smallest coin that covers the rest, its change in the fewest coins. */
export function pay(gear: Gear, price: number): { gear: Gear; change: number } | null {
  const bag = bagCounts(gear.bag), cloth = bagCounts(gear.cloth);
  const have = (coin: CoinId) => (bag[coin] ?? 0) + (cloth[coin] ?? 0);
  const given: ItemCounts = {};
  let left = price;
  for (const coin of [...COINS].reverse()) {
    const n = Math.min(have(coin), Math.floor(left / COIN_VALUE[coin]));
    if (n > 0) given[coin] = n;
    left -= n * COIN_VALUE[coin];
  }
  let change = 0;
  if (left > 0) {
    const cover = [...COINS].reverse().find((coin) => have(coin) > (given[coin] ?? 0) && COIN_VALUE[coin] >= left);
    if (!cover) return null;
    given[cover] = (given[cover] ?? 0) + 1;
    change = COIN_VALUE[cover] - left;
  }
  let paid: Gear | null = gear;
  for (const [coin, n] of Object.entries(given) as [CoinId, number][]) paid = paid && take(paid, coin, n);
  return paid && { gear: paid, change };
}

export function trading(session: GameSession): ShopId | null {
  return session.inOverworld && !session.busyUsing ? session.shop : null;
}

export function done(session: GameSession, id: ShopId, news: TradeNews, gear?: Gear): void {
  if (gear) {
    session.gear = gear;
    session.saveSoon();
  }
  session.link.send({ t: "trade", news, gear: session.gear, shop: viewFor(session, id) });
}

const viewFor = (session: GameSession, id: ShopId) =>
  shopView(id, session.region, session.shopsBought.includes(id));

export function openShop(session: GameSession): void {
  const id = session.inOverworld ? shopInView(session) : null;
  if (!id) return;
  session.shop = id;
  session.link.send({ t: "shop", shop: viewFor(session, id) });
}

export function buy(session: GameSession, item: ItemId): void {
  const id = trading(session);
  if (!id) return;
  const offered = viewFor(session, id).stock.find((s) => s.item === item);
  if (!offered) return done(session, id, { kind: "refused", reason: "notSold" });
  const paid = pay(session.gear, offered.price);
  if (!paid) return done(session, id, { kind: "refused", reason: "tooPoor" });
  const got = receive(paid.gear, { [item]: 1, ...coinsFor(paid.change) });
  if (!got) return done(session, id, { kind: "refused", reason: "noRoom" });
  if (!session.shopsBought.includes(id)) session.shopsBought = [...session.shopsBought, id];
  done(session, id, { kind: "bought", item, price: offered.price, onCloth: got.onCloth }, got.gear);
}

export function sell(session: GameSession, at: UseSpot, count: number): void {
  const id = trading(session);
  if (!id) return;
  const grid = session.gear[at.in], i = itemAt(grid, at), stack = grid.items[i];
  if (!stack) return;
  const each = viewFor(session, id).buys[stack.item];
  if (each === undefined) return done(session, id, { kind: "refused", reason: "notBought" });
  const sold = Math.min(count, stack.count);
  const items = grid.items.map((s, k) => k === i ? { ...s, count: s.count - sold } : s).filter((s) => s.count > 0);
  const got = receive({ ...session.gear, [at.in]: { ...grid, items } }, coinsFor(each * sold));
  if (!got) return done(session, id, { kind: "refused", reason: "noRoom" });
  const news = { kind: "sold", item: stack.item, count: sold, price: each * sold, onCloth: got.onCloth } as const;
  done(session, id, news, got.gear);
}

export function exchange(session: GameSession, from: CoinId, to: CoinId): void {
  const id = trading(session);
  const rate = exchangeRate(from, to);
  if (!id || !rate) return;
  const paid = take(session.gear, from, rate.give);
  if (!paid) return done(session, id, { kind: "refused", reason: "noCoins" });
  const got = receive(paid, { [to]: rate.get });
  if (!got) return done(session, id, { kind: "refused", reason: "noRoom" });
  done(session, id, { kind: "exchanged", from, to, onCloth: got.onCloth }, got.gear);
}
