import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SWING_DIRS } from "@infinite-tower/shared";
import { ringLights, wedgeOf } from "../../../src/visuals/battle/aimRing.js";
import { waySwingAt } from "../../fixtures/swings.js";

describe("the hybrid's aim ring", () => {
  test("a wedge for each side a swing can come from: 0 the right, then anticlockwise", () => {
    assert.equal(wedgeOf("rl"), 0);
    assert.equal(wedgeOf("trbl"), 1);
    assert.equal(wedgeOf("tb"), 2);
    assert.equal(wedgeOf("tlbr"), 3);
    assert.equal(wedgeOf("lr"), 4);
    assert.equal(wedgeOf("bt"), 6);
    assert.equal(new Set(SWING_DIRS.map(wedgeOf)).size, 8);
  });

  test("lights your aim, and the foe's swing as you see it from in front, while it winds up and lands", () => {
    const { liveUntil } = waySwingAt("lr", 0);
    assert.deepEqual(ringLights("lr", null), { mine: 4, foe: null, stab: false });
    const coming = ringLights(null, waySwingAt("lr", 1));
    assert.deepEqual(coming, { mine: null, foe: 0, stab: false }, "its left, your right");
    assert.deepEqual(ringLights("tb", waySwingAt("tb", liveUntil - 1)), { mine: 2, foe: 2, stab: false });
    assert.equal(ringLights(null, waySwingAt("lr", liveUntil)).foe, null, "over once it's landed");
  });

  test("a stab coming lights the centre instead", () => {
    assert.deepEqual(ringLights("lr", waySwingAt("stab", 2)), { mine: 4, foe: null, stab: true });
  });
});
