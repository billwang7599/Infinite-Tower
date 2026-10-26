import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { emptyBag, ITEMS, type Bag } from "@infinite-tower/shared";
import { packLoot } from "../../../src/core/game/inventory.js";

const MEAT_STACK = ITEMS["boar-meat"].stackSize;

describe("packLoot", () => {
  test("puts everything in the bag when there's room", () => {
    const { bag, left } = packLoot(emptyBag(), { "boar-meat": 2, "boar-tusk": 1 });
    assert.deepEqual(left, {});
    assert.deepEqual(bag.items.map((s) => [s.item, s.count]), [["boar-meat", 2], ["boar-tusk", 1]]);
  });

  test("what doesn't fit is left behind, by item", () => {
    const tiny: Bag = { cols: 1, rows: 1, items: [] };
    const { bag, left } = packLoot(tiny, { "boar-meat": MEAT_STACK + 1, "boar-hide": 1 });
    assert.deepEqual(left, { "boar-meat": 1, "boar-hide": 1 });
    assert.deepEqual(bag.items.map((s) => [s.item, s.count]), [["boar-meat", MEAT_STACK]]);
  });

  test("no loot leaves the bag as it was", () => {
    const start = emptyBag();
    assert.deepEqual(packLoot(start, {}), { bag: start, left: {} });
  });
});
