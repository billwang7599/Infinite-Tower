import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addItem, bagCounts, COIN_VALUE, emptyBag, emptyCloth, type Bag, type ItemCounts, type ItemId, type NpcId,
} from "@infinite-tower/shared";
import {
  FIRST_PURCHASE_DISCOUNT, ITEM_VALUES, PRICE_FACTOR, SELL_SHARE, SHOPS,
} from "../../../src/core/content/shops.js";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import type { PlayerSave } from "../../../src/core/ports.js";
import { bagWith, startIn, talkTo } from "./helpers.js";

const SILVER = COIN_VALUE["silver-coin"], GOLD = COIN_VALUE["gold-coin"];
const price = (item: ItemId) => Math.round(ITEM_VALUES[item]! * PRICE_FACTOR["market-ward"]!);
const firstPrice = (item: ItemId) => Math.round(price(item) * (1 - FIRST_PURCHASE_DISCOUNT));
const sellPrice = (item: ItemId) => Math.floor(ITEM_VALUES[item]! * SELL_SHARE);

function atShop(npc: NpcId, bag: Bag, saved: Partial<PlayerSave> = {}) {
  const started = startIn("market-ward", { saved: { bag, ...saved } });
  const said = talkTo(started.session, started.link, npc);
  started.session.openShop();
  return { ...started, said };
}

const counts = (bag: Bag): ItemCounts => bagCounts(bag);

function packed(grid: Bag, free = 0): Bag {
  const tusks = (grid.cols * grid.rows - free) / 2;
  return { ...grid, items: addItem({ ...grid, items: [] }, "boar-tusk", tusks).bag.items };
}

describe("shops", () => {
  test("the food, potion and blacksmith keepers and a money changer stand in Highmere's Market Ward, each offering trade", () => {
    for (const npc of ["grocer", "apothecary", "smith", "changer"] as const) {
      assert.equal(stopFor(newStory(), NPCS[npc])?.level, "market-ward", npc);
      const { said, link } = atShop(npc, emptyBag());
      assert.equal(said.offer?.kind, "shop", npc);
      assert.ok(link.last("shop").shop, npc);
    }
  });

  test("a shop sells at its place's prices, the first purchase cheaper, and buys at a share of worth", () => {
    const { link } = atShop("grocer", emptyBag());
    const view = link.last("shop").shop!;
    const stock = SHOPS.grocer.sells.map((item) => ({ item, price: firstPrice(item), fullPrice: price(item) }));
    assert.deepEqual(view.stock, stock);
    assert.deepEqual(view.buys, Object.fromEntries(SHOPS.grocer.buys.map((item) => [item, sellPrice(item)])));
    assert.ok(price("bread") > ITEM_VALUES.bread!, "the capital is dearer");
  });

  test("nobody's shop opens without its keeper in view", () => {
    const { session, link } = startIn("market-ward");
    session.openShop();
    assert.equal(link.all("shop").length, 0);
  });

  test("buying takes coins and gives change in the fewest coins; only the first purchase is cheaper", () => {
    const { session, link, saves } = atShop("grocer", bagWith({ "gold-coin": 1 }));
    session.buy("bread");
    const first = firstPrice("bread");
    const change = GOLD - first;
    assert.deepEqual(counts(session.bag), {
      "silver-coin": Math.floor(change / SILVER), "copper-coin": change % SILVER, bread: 1,
    });
    assert.deepEqual(link.last("trade").news, { kind: "bought", item: "bread", price: first, onCloth: false });
    assert.deepEqual(link.last("trade").shop.stock[0], { item: "bread", price: price("bread"), fullPrice: price("bread") });

    session.buy("bread");
    assert.equal(counts(session.bag)["copper-coin"], change % SILVER - price("bread"));
    session.disconnect();
    assert.deepEqual(saves.at(-1)?.shopsBought, ["grocer"]);
  });

  test("coins are spent smallest first and never packed up: 100 copper stays 100 copper", () => {
    const potion = price("health-potion");
    const { session } = atShop("apothecary", bagWith({ "copper-coin": 150 }), { shopsBought: ["apothecary"] });
    session.buy("health-potion");
    assert.deepEqual(counts(session.bag), { "copper-coin": 150 - potion, "health-potion": 1 });

    const short = 50;
    const second = atShop("apothecary", bagWith({ "copper-coin": short, "silver-coin": 1 }), { shopsBought: ["apothecary"] });
    second.session.buy("health-potion");
    assert.deepEqual(counts(second.session.bag), { "copper-coin": SILVER - (potion - short), "health-potion": 1 });
  });

  test("too little money buys nothing", () => {
    const bag = bagWith({ "copper-coin": firstPrice("bread") - 1 });
    const { session, link } = atShop("grocer", bag);
    session.buy("bread");
    assert.deepEqual(session.bag, bag);
    assert.deepEqual(link.last("trade").news, { kind: "refused", reason: "tooPoor" });
  });

  test("what doesn't fit in the bag lands on the cloth, and with no room there either nothing is bought", () => {
    const bag = addItem(packed(emptyBag(), 2), "gold-coin", 1).bag;
    const { session, link } = atShop("grocer", bag);
    session.buy("bread");
    assert.equal(link.last("trade").news.kind, "bought");
    assert.deepEqual(link.last("trade").news, { kind: "bought", item: "bread", price: firstPrice("bread"), onCloth: true });
    const all = { ...counts(session.bag) };
    for (const [item, n] of Object.entries(counts(session.gear.cloth))) all[item as ItemId] = (all[item as ItemId] ?? 0) + n;
    assert.equal(all.bread, 1);
    assert.ok(session.gear.cloth.items.length > 0);

    const full = atShop("grocer", bag);
    full.session.gear = { ...full.session.gear, cloth: packed(emptyCloth()) };
    full.session.buy("bread");
    assert.deepEqual(full.session.bag, bag);
    assert.deepEqual(full.link.last("trade").news, { kind: "refused", reason: "noRoom" });
  });

  test("a shop sells only its stock", () => {
    const bag = bagWith({ "gold-coin": 1 });
    const { session, link } = atShop("grocer", bag);
    session.buy("greatsword");
    assert.deepEqual(session.bag, bag);
    assert.deepEqual(link.last("trade").news, { kind: "refused", reason: "notSold" });
  });

  test("selling some of a stack pays for each in coins", () => {
    const { session, link } = atShop("grocer", bagWith({ "boar-meat": 5 }));
    session.sell({ in: "bag", x: 0, y: 0 }, 3);
    assert.deepEqual(counts(session.bag), { "boar-meat": 2, "copper-coin": 3 * sellPrice("boar-meat") });
    assert.deepEqual(link.last("trade").news, {
      kind: "sold", item: "boar-meat", count: 3, price: 3 * sellPrice("boar-meat"), onCloth: false,
    });
  });

  test("a shop buys only what it deals in", () => {
    const bag = bagWith({ "boar-meat": 1 });
    const { session, link } = atShop("smith", bag);
    session.sell({ in: "bag", x: 0, y: 0 }, 1);
    assert.deepEqual(session.bag, bag);
    assert.deepEqual(link.last("trade").news, { kind: "refused", reason: "notBought" });
    const view = link.last("shop").shop!;
    assert.equal(view.buys["boar-meat"], undefined);
    assert.ok(view.buys["boar-hide"]);
  });

  test("any shop, and the money changer, change a coin for 100 of the one below and back", () => {
    for (const npc of ["grocer", "changer"] as const) {
      const { session } = atShop(npc, bagWith({ "silver-coin": 1, "copper-coin": 99 }));
      session.exchange("silver-coin", "copper-coin");
      assert.deepEqual(counts(session.bag), { "copper-coin": 199 }, npc);
      session.exchange("copper-coin", "silver-coin");
      assert.deepEqual(counts(session.bag), { "copper-coin": 99, "silver-coin": 1 }, npc);
      session.exchange("copper-coin", "silver-coin");
      assert.deepEqual(counts(session.bag), { "copper-coin": 99, "silver-coin": 1 }, `${npc}: 99 isn't enough`);
      session.exchange("copper-coin", "gold-coin");
      assert.deepEqual(counts(session.bag), { "copper-coin": 99, "silver-coin": 1 }, `${npc}: one tier at a time`);
    }
  });

  test("the money changer sells and buys nothing", () => {
    const { link } = atShop("changer", emptyBag());
    const view = link.last("shop").shop!;
    assert.deepEqual(view.stock, []);
    assert.deepEqual(view.buys, {});
  });

  test("closing the bag or walking away ends the trade", () => {
    const bag = bagWith({ "gold-coin": 1 });
    const { session, link } = atShop("grocer", bag);
    session.closeBag();
    assert.equal(link.last("shop").shop, null);
    session.buy("bread");
    assert.deepEqual(session.bag, bag);

    const walked = atShop("grocer", bag);
    walked.session.input(1, 1, 0);
    assert.equal(walked.link.last("shop").shop, null);
    walked.session.buy("bread");
    assert.deepEqual(walked.session.bag, bag);
  });
});
