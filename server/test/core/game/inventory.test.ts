import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addItems, MAX_STACK, removeOne } from "../../../src/core/game/inventory.js";

describe("addItems", () => {
  test("adds loot to what's carried", () => {
    assert.deepEqual(addItems({ "boar-meat": 2 }, { "boar-meat": 3 }), { "boar-meat": 5 });
  });

  test("adds an item the player didn't have", () => {
    assert.deepEqual(addItems({}, { "boar-meat": 1 }), { "boar-meat": 1 });
  });

  test("caps each item at MAX_STACK", () => {
    assert.deepEqual(addItems({ "boar-meat": MAX_STACK - 1 }, { "boar-meat": 5 }), { "boar-meat": MAX_STACK });
    assert.deepEqual(addItems({ "boar-meat": MAX_STACK }, { "boar-meat": 1 }), { "boar-meat": MAX_STACK });
  });

  test("no loot leaves the inventory as it was", () => {
    assert.deepEqual(addItems({ "boar-meat": 4 }, {}), { "boar-meat": 4 });
  });

  test("returns a new inventory and doesn't change either input", () => {
    const into = Object.freeze({ "boar-meat": 1 });
    const loot = Object.freeze({ "boar-meat": 1 });
    const next = addItems(into, loot);
    assert.notEqual(next, into);
    assert.deepEqual(into, { "boar-meat": 1 });
    assert.deepEqual(loot, { "boar-meat": 1 });
  });
});

describe("removeOne", () => {
  test("takes one away", () => {
    assert.deepEqual(removeOne({ "boar-meat": 3 }, "boar-meat"), { "boar-meat": 2 });
  });

  test("deletes the item when the last one goes", () => {
    const next = removeOne({ "boar-meat": 1 }, "boar-meat");
    assert.deepEqual(next, {});
    assert.equal("boar-meat" in next, false);
  });

  test("an item the player doesn't have stays absent, never negative", () => {
    assert.deepEqual(removeOne({}, "boar-meat"), {});
  });

  test("doesn't change its input", () => {
    const from = Object.freeze({ "boar-meat": 2 });
    removeOne(from, "boar-meat");
    assert.deepEqual(from, { "boar-meat": 2 });
  });
});
