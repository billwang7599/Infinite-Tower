import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import {
  bagCounts, bagProblems, FIXED_DT, HEADING_WAY, ITEMS, PILE_LOOK_RAD, PILE_RANGE_M, START_HEADING, type ItemCounts,
} from "@infinite-tower/shared";
import { OverworldPos, Pile } from "../../../src/core/overworld/components.js";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import {
  PILE_COLS, PILE_LAG_SLACK_M, PILE_LIFETIME_MS, PILE_LOOK_SLACK_RAD,
} from "../../../src/core/overworld/piles.js";
import { TEST_CHARACTER, TEST_LEVEL } from "../../fixtures/level.js";

const LOOT: ItemCounts = { "boar-meat": 2, "boar-hide": 1, "boar-tusk": 1 };

const lying = (overworld: Overworld) => [...overworld.world.query(Pile, OverworldPos)].length;

function clock(t: TestContext): (ms: number) => void {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  return (ms) => t.mock.timers.tick(ms);
}

describe("a pile on the overworld", () => {
  test("holds every item dropped, laid out PILE_COLS wide with nothing overlapping", () => {
    const overworld = new Overworld(TEST_LEVEL);
    const pile = overworld.dropPile({ x: 3, z: 1 }, LOOT)!;
    const items = overworld.pileItems(pile)!;
    assert.deepEqual(bagCounts(items), LOOT);
    assert.equal(items.cols, PILE_COLS);
    assert.deepEqual(bagProblems(items), []);
  });

  test("grows rows for as much as is dropped", () => {
    const overworld = new Overworld(TEST_LEVEL);
    const many: ItemCounts = { "boar-hide": 5, greatsword: 1, "boar-meat": ITEMS["boar-meat"].stackSize * 3 + 1 };
    const items = overworld.pileItems(overworld.dropPile({ x: 0, z: 0 }, many)!)!;
    assert.deepEqual(bagCounts(items), many);
    assert.deepEqual(bagProblems(items), []);
  });

  test("nothing dropped makes no pile", () => {
    const overworld = new Overworld(TEST_LEVEL);
    assert.equal(overworld.dropPile({ x: 0, z: 0 }, {}), null);
    assert.equal(lying(overworld), 0);
  });

  test("a player sees the one in reach and in front of the way they face, each with the lag slack", () => {
    const overworld = new Overworld(TEST_LEVEL);
    const me = overworld.join(TEST_CHARACTER, () => {});
    overworld.place(me, { x: 0, z: 0 });
    const ahead = HEADING_WAY[START_HEADING], reachM = PILE_RANGE_M + PILE_LAG_SLACK_M;
    const lookRad = PILE_LOOK_RAD + PILE_LOOK_SLACK_RAD;
    overworld.dropPile({ x: -ahead.x, z: -ahead.z }, LOOT);
    overworld.dropPile({ x: ahead.x * (reachM + 0.1), z: ahead.z * (reachM + 0.1) }, LOOT);
    const off = (rad: number) => ({
      x: ahead.x * Math.cos(rad) - ahead.z * Math.sin(rad), z: ahead.x * Math.sin(rad) + ahead.z * Math.cos(rad),
    });
    overworld.dropPile(off(lookRad + 0.02), LOOT);
    assert.equal(overworld.pileInView(me), null, "behind, too far, or too far round");
    const seen = overworld.dropPile(off(lookRad - 0.02), LOOT);
    assert.equal(overworld.pileInView(me), seen);
  });

  test("taking everything off it makes it vanish", () => {
    const overworld = new Overworld(TEST_LEVEL);
    const pile = overworld.dropPile({ x: 0, z: 0 }, LOOT)!;
    const items = overworld.pileItems(pile)!;
    overworld.setPileItems(pile, { ...items, items: items.items.slice(1) });
    assert.equal(overworld.pileItems(pile)!.items.length, items.items.length - 1);
    overworld.setPileItems(pile, { ...items, items: [] });
    assert.equal(overworld.pileItems(pile), null);
    assert.equal(lying(overworld), 0);
  });

  test("vanishes PILE_LIFETIME_MS after it lands, not before", (t) => {
    const advance = clock(t);
    const overworld = new Overworld(TEST_LEVEL);
    const pile = overworld.dropPile({ x: 0, z: 0 }, LOOT)!;
    advance(PILE_LIFETIME_MS - 1);
    overworld.step(FIXED_DT);
    assert.notEqual(overworld.pileItems(pile), null);
    advance(1);
    overworld.step(FIXED_DT);
    assert.equal(overworld.pileItems(pile), null);
  });

  test("each pile keeps its own time", (t) => {
    const advance = clock(t);
    const overworld = new Overworld(TEST_LEVEL);
    const first = overworld.dropPile({ x: 0, z: 0 }, LOOT)!;
    advance(PILE_LIFETIME_MS / 2);
    const second = overworld.dropPile({ x: 1, z: 0 }, LOOT)!;
    advance(PILE_LIFETIME_MS / 2);
    overworld.step(FIXED_DT);
    assert.equal(overworld.pileItems(first), null);
    assert.notEqual(overworld.pileItems(second), null);
  });
});
