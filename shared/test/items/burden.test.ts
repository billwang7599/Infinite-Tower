import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BASE_STATS, BURDEN, burdenOf, carryLimit, dodgeCost, emptyCloth, emptyEquipment, gearBurden, ITEMS, moveSpeed,
  NO_PILE, overworldPace, packFor, PLAYER, walkPace, type Bag, type Gear,
} from "@infinite-tower/shared";

const STATS = BASE_STATS;
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

const only = (bag: Bag): Gear =>
  ({ bag, pack: packFor(null), cloth: emptyCloth(), pile: NO_PILE, equipment: emptyEquipment() });

describe("gearBurden", () => {
  test("weighs the bag against the carry limit from strength", () => {
    const atLimit = LIMIT / TUSK;
    assert.equal(gearBurden(only(tusks(atLimit)), STATS), "light");
    assert.equal(gearBurden(only(tusks(atLimit + 1)), STATS), "heavy");
    assert.equal(gearBurden(only(tusks(atLimit + 3)), STATS), "overloaded");
  });

  test("more strength carries more", () => {
    const stronger = { ...STATS, strength: STATS.strength * 4 };
    assert.equal(gearBurden(only(tusks(LIMIT / TUSK + 3)), stronger), "light");
  });
});

describe("what a burden does", () => {
  test("only overloaded slows walking", () => {
    assert.equal(walkPace("light"), 1);
    assert.equal(walkPace("heavy"), 1);
    assert.equal(walkPace("overloaded"), 0.5);
  });

  test("on the overworld, the burden's pace and agility, as in the arena", () => {
    const quick = { ...STATS, agility: STATS.agility * 16 };
    assert.equal(overworldPace(only(tusks(1)), STATS), 1);
    assert.equal(overworldPace(only(tusks(1)), quick), moveSpeed(1, quick));
    assert.equal(overworldPace(only(tusks(LIMIT / TUSK + 3)), quick), moveSpeed(walkPace("overloaded"), quick));
  });

  test("heavy makes a dodge cost more stamina; overloaded can't dodge", () => {
    assert.equal(dodgeCost("light"), PLAYER.dodge.cost);
    assert.ok(dodgeCost("heavy")! > PLAYER.dodge.cost);
    assert.equal(dodgeCost("heavy"), PLAYER.dodge.cost * BURDEN.heavyDodgeCost);
    assert.equal(dodgeCost("overloaded"), null);
  });
});
