import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ITEMS, type BagItem, type ItemId } from "@infinite-tower/shared";
import { formatWeight, itemInfo } from "../../../../src/ui/hud/inventory/itemInfo.js";

const stack = (item: ItemId, count = 1, turned = false): BagItem => ({ item, count, x: 0, y: 0, turned });

describe("itemInfo (the tooltip)", () => {
  test("names the item and how many there are", () => {
    assert.equal(itemInfo(stack("boar-meat", 3)).name, `${ITEMS["boar-meat"].name} ×3`);
    assert.equal(itemInfo(stack("boar-hide")).name, ITEMS["boar-hide"].name);
  });

  test("gives its size in cells as it lies", () => {
    const { cols, rows } = ITEMS["boar-tusk"];
    assert.equal(itemInfo(stack("boar-tusk")).size, `${cols} × ${rows}`);
    assert.equal(itemInfo(stack("boar-tusk", 1, true)).size, `${rows} × ${cols}`);
  });

  test("gives its weight, and a stack's in all", () => {
    assert.equal(itemInfo(stack("boar-tusk")).weight, formatWeight(ITEMS["boar-tusk"].weight));
    const each = ITEMS["boar-meat"].weight;
    const all = formatWeight(3 * each);
    assert.equal(itemInfo(stack("boar-meat", 3)).weight, `${formatWeight(each)} each, ${all} in all`);
  });

  test("says what it does: food says how much it heals; things that do nothing say nothing", () => {
    assert.match(itemInfo(stack("boar-meat")).effect ?? "", new RegExp(`Heals ${ITEMS["boar-meat"].healHp} HP`));
    assert.equal(itemInfo(stack("boar-hide")).effect, null);
  });

  test("the sword and the spellbook say what holding them lets you do", () => {
    assert.equal(itemInfo(stack("sword")).effect, "In a hand: swing, stab and block.");
    assert.equal(itemInfo(stack("spellbook")).effect, "In a hand: cast spells.");
  });

  test("weights show one decimal place at most", () => {
    assert.equal(formatWeight(12), "12");
    assert.equal(formatWeight(12.5), "12.5");
    assert.equal(formatWeight(0.1 + 0.2), "0.3");
  });
});
