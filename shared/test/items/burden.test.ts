import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bagBurden, BURDEN, burdenOf, carryLimit, dodgeCost, ITEMS, PLAYER, walkPace, type Bag, type Stats,
} from "@infinite-tower/shared";

const STATS: Stats = { stamina: 100, mana: 50, spellpower: 10, agility: 10, strength: 10 };
const LIMIT = carryLimit(STATS);
const TUSK = ITEMS["boar-tusk"].weight;

/** `count` tusks standing side by side in a bag wide enough for them. */
const tusks = (count: number): Bag => ({
  cols: count, rows: ITEMS["boar-tusk"].rows,
  items: Array.from({ length: count }, (_, x) => ({ item: "boar-tusk" as const, count: 1, x, y: 0, turned: false })),
});

describe("burdenOf", () => {
  test("up to the carry limit weighs you down not at all", () => {
    assert.equal(burdenOf(0, LIMIT), "light");
    assert.equal(burdenOf(LIMIT, LIMIT), "light");
  });

  test("over the limit is heavy, up to the overloaded line", () => {
    assert.equal(burdenOf(LIMIT + 0.5, LIMIT), "heavy");
    assert.equal(burdenOf(LIMIT * BURDEN.overloadedAt, LIMIT), "heavy");
  });

  test("past the overloaded line (20% over the limit) is overloaded", () => {
    assert.equal(BURDEN.overloadedAt, 1.2);
    assert.equal(burdenOf(LIMIT * BURDEN.overloadedAt + 0.5, LIMIT), "overloaded");
  });
});

describe("bagBurden", () => {
  test("weighs the bag against the carry limit from strength", () => {
    const atLimit = LIMIT / TUSK;
    assert.equal(bagBurden(tusks(atLimit), STATS), "light");
    assert.equal(bagBurden(tusks(atLimit + 1), STATS), "heavy");
    assert.equal(bagBurden(tusks(atLimit + 3), STATS), "overloaded");
  });

  test("more strength carries more", () => {
    const stronger = { ...STATS, strength: STATS.strength + 10 };
    assert.equal(bagBurden(tusks(LIMIT / TUSK + 3), stronger), "light");
  });
});

describe("what a burden does", () => {
  test("only overloaded slows walking", () => {
    assert.equal(walkPace("light"), 1);
    assert.equal(walkPace("heavy"), 1);
    assert.equal(walkPace("overloaded"), 0.5);
  });

  test("heavy makes a dodge cost more stamina; overloaded can't dodge", () => {
    assert.equal(dodgeCost("light"), PLAYER.dodge.cost);
    assert.ok(dodgeCost("heavy")! > PLAYER.dodge.cost);
    assert.equal(dodgeCost("heavy"), PLAYER.dodge.cost * BURDEN.heavyDodgeCost);
    assert.equal(dodgeCost("overloaded"), null);
  });
});
