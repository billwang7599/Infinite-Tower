import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ARENA_LOOK_IDS } from "@infinite-tower/shared";
import { ARENA_LOOKS } from "../../../src/visuals/arenas/index.js";

describe("arena looks", () => {
  test("every look an arena can name is drawn, lit and fogged", () => {
    assert.deepEqual(Object.keys(ARENA_LOOKS).sort(), [...ARENA_LOOK_IDS].sort());
    for (const id of ARENA_LOOK_IDS) {
      const { env, build } = ARENA_LOOKS[id];
      assert.equal(typeof build, "function", id);
      assert.ok(env.fogDensity > 0 && env.sun.intensity > 0 && env.skyLight.intensity > 0, id);
    }
  });

  test("dusky but not black: every sky is a muted, middle grey", () => {
    for (const id of ARENA_LOOK_IDS) {
      const { r, g, b } = ARENA_LOOKS[id].env.sky;
      const light = (r + g + b) / 3;
      assert.ok(light > 0.15 && light < 0.45, `${id} lightness ${light}`);
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) < 0.15, `${id} is muted`);
    }
  });
});
