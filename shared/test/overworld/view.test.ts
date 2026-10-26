import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { VIEW, viewCenter, viewHalfWidth, type LevelLayout } from "@infinite-tower/shared";
import { TEST_LAYOUT } from "./level.js";

describe("viewHalfWidth", () => {
  test("grows with the screen's width, up to 16:9", () => {
    assert.equal(viewHalfWidth(1), VIEW.halfHeight);
    assert.equal(viewHalfWidth(VIEW.maxAspect), VIEW.halfHeight * VIEW.maxAspect);
    assert.equal(viewHalfWidth(3), viewHalfWidth(VIEW.maxAspect), "an ultrawide screen sees no more");
  });
});

describe("viewCenter", () => {
  const big: LevelLayout = { ...TEST_LAYOUT, halfWidth: 40, halfDepth: 30 };
  const halfWidth = viewHalfWidth(VIEW.maxAspect);

  test("follows the player in the middle of a level", () => {
    assert.deepEqual(viewCenter(big, { x: 3, z: -2 }, halfWidth), { x: 3, z: -2 });
  });

  test("stops so the view shows at most `overscan` tiles past the edge", () => {
    const c = viewCenter(big, { x: 40, z: -30 }, halfWidth);
    assert.equal(c.x + halfWidth, big.halfWidth + VIEW.overscan);
    assert.equal(c.z - VIEW.halfHeight, -(big.halfDepth + VIEW.overscan));
  });

  test("stays centered on a level smaller than the view", () => {
    const tiny: LevelLayout = { ...TEST_LAYOUT, halfWidth: 2, halfDepth: 2 };
    assert.deepEqual(viewCenter(tiny, { x: 1, z: 1 }, halfWidth), { x: 0, z: 0 });
  });
});
