import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ringLights, wedgeOf } from "../../../src/visuals/battle/aimRing.js";
import { swingAt, waySwingAt } from "../../fixtures/swings.js";

describe("your own aim ring", () => {
  test("lights the wedge on the side the aimed swing comes from", () => {
    assert.equal(wedgeOf("rl"), 0);
    assert.equal(wedgeOf("trbl"), 1);
    assert.equal(wedgeOf("tb"), 2);
    assert.equal(wedgeOf("tlbr"), 3);
    assert.equal(wedgeOf("lr"), 4);
    assert.equal(wedgeOf("bltr"), 5);
    assert.equal(wedgeOf("brtl"), 7);
  });

  test("shows the aim with no swing going, not only on attack", () => {
    assert.deepEqual(ringLights("lr", null), { lit: 4, stab: false });
  });

  test("a stab shows the centre mark only while it winds up", () => {
    const { liveAt } = swingAt("light", "stab", 0);
    assert.equal(ringLights("tb", waySwingAt("stab", 0)).stab, true);
    assert.equal(ringLights("tb", waySwingAt("stab", liveAt)).stab, false);
    assert.equal(ringLights("tb", waySwingAt("lr", 0)).stab, false);
  });
});
