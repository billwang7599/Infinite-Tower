import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  emptyBag, finishUse, FIXED_DT, ITEM_IDS, itemDef, ITEMS, startUse, stepUse, useSteps, type Bag, type ItemId,
  type UseSpot,
} from "@infinite-tower/shared";

const MAX_HP = 100;
const MEAT = ITEMS["boar-meat"].consumable;
const HEAL_HP = MEAT.effects[0].healHp;
const AT: UseSpot = { in: "bag", x: 1, y: 0 };
const bagWith = (item: ItemId, count: number): Bag =>
  ({ ...emptyBag(), items: [{ item, count, x: AT.x, y: AT.y, turned: false }] });
const hurt = (hp: number) => ({ hp, max: MAX_HP });

describe("startUse", () => {
  test("meat while hurt: using it starts, for as many steps as its useTime", () => {
    assert.deepEqual(startUse(bagWith("boar-meat", 2), AT, hurt(50)), {
      at: AT, item: "boar-meat", stepsLeft: Math.round(MEAT.useTime / FIXED_DT),
    });
  });

  test("not at full HP, not from an empty cell, not what isn't consumable", () => {
    assert.equal(startUse(bagWith("boar-meat", 2), AT, hurt(MAX_HP)), null);
    assert.equal(startUse(bagWith("boar-meat", 2), { in: "bag", x: 4, y: 3 }, hurt(50)), null);
    assert.equal(startUse(bagWith("boar-tusk", 1), AT, hurt(50)), null);
  });
});

describe("stepUse", () => {
  test("done once its item's useTime has gone by, counted in steps as both sides count them", () => {
    let using = startUse(bagWith("boar-meat", 2), AT, hurt(50))!;
    for (let i = 0; i < useSteps("boar-meat") - 1; i++) using = stepUse(using);
    assert.ok(using.stepsLeft > 0);
    assert.equal(stepUse(using).stepsLeft, 0);
  });
});

describe("finishUse", () => {
  test("one is used up and its item's effects applied: the HP healed, capped at the most", () => {
    const using = startUse(bagWith("boar-meat", 2), AT, hurt(50))!;
    const target = hurt(50);
    assert.deepEqual(finishUse(using, bagWith("boar-meat", 2), target), bagWith("boar-meat", 1));
    assert.equal(target.hp, 50 + HEAL_HP);
    const nearlyFull = hurt(MAX_HP - 1);
    assert.deepEqual(finishUse(using, bagWith("boar-meat", 1), nearlyFull), emptyBag());
    assert.equal(nearlyFull.hp, MAX_HP);
  });

  test("nothing if it's no longer there", () => {
    const using = startUse(bagWith("boar-meat", 1), AT, hurt(50))!;
    const target = hurt(50);
    assert.equal(finishUse(using, emptyBag(), target), null);
    assert.equal(finishUse(using, bagWith("boar-tusk", 1), target), null);
    assert.equal(target.hp, 50);
  });
});

describe("any consumable", () => {
  test("takes its item's useTime and does its item's effects", () => {
    for (const id of ITEM_IDS) {
      const consumable = itemDef(id).consumable;
      if (!consumable) continue;
      const target = { hp: 1, max: Infinity };
      let using = startUse(bagWith(id, 1), AT, target)!, steps = 0;
      for (; using.stepsLeft > 0; steps++) using = stepUse(using);
      assert.equal(steps, Math.round(consumable.useTime / FIXED_DT), id);
      finishUse(using, bagWith(id, 1), target);
      assert.equal(target.hp, 1 + consumable.effects.reduce((sum, effect) => sum + effect.healHp, 0), id);
    }
  });
});
