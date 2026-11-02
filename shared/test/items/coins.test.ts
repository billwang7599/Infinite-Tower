import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addItem, COIN_VALUE, coinsFor, emptyBag, exchangeRate, formatPrice, ITEMS, moneyIn, type Bag,
} from "@infinite-tower/shared";

const SILVER = COIN_VALUE["silver-coin"], GOLD = COIN_VALUE["gold-coin"];

describe("coins", () => {
  test("three tiers, each 100 of the one below, stacking to 100 in a cell", () => {
    assert.equal(COIN_VALUE["copper-coin"], 1);
    assert.equal(SILVER, 100);
    assert.equal(GOLD, 100 * SILVER);
    for (const coin of ["copper-coin", "silver-coin", "gold-coin"] as const) {
      assert.equal(ITEMS[coin].stackSize, 100);
      assert.equal(ITEMS[coin].cols * ITEMS[coin].rows, 1);
    }
  });

  test("a price reads in gold, silver and copper, leaving out what's 0", () => {
    assert.equal(formatPrice(GOLD + 20 * SILVER + 5), "1g 20s 5c");
    assert.equal(formatPrice(4 * SILVER + 50), "4s 50c");
    assert.equal(formatPrice(3 * GOLD), "3g");
    assert.equal(formatPrice(7), "7c");
    assert.equal(formatPrice(0), "0c");
  });

  test("an amount in the fewest coins", () => {
    assert.deepEqual(coinsFor(GOLD + 2 * SILVER + 99), { "gold-coin": 1, "silver-coin": 2, "copper-coin": 99 });
    assert.deepEqual(coinsFor(SILVER), { "silver-coin": 1 });
    assert.deepEqual(coinsFor(0), {});
  });

  test("coins change one tier at a time, either way", () => {
    assert.deepEqual(exchangeRate("silver-coin", "copper-coin"), { give: 1, get: SILVER });
    assert.deepEqual(exchangeRate("silver-coin", "gold-coin"), { give: GOLD / SILVER, get: 1 });
    assert.equal(exchangeRate("copper-coin", "gold-coin"), null);
    assert.equal(exchangeRate("gold-coin", "gold-coin"), null);
  });

  test("the money in some grids is every coin there at its worth", () => {
    let bag: Bag = addItem(emptyBag(), "copper-coin", 150).bag;
    bag = addItem(bag, "boar-meat", 2).bag;
    const cloth = addItem(emptyBag(), "gold-coin", 1).bag;
    assert.equal(moneyIn(bag, cloth), 150 + GOLD);
    assert.equal(moneyIn(emptyBag()), 0);
  });
});
