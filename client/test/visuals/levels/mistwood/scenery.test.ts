import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inRect, mapHalfSize, type LevelLayout } from "@infinite-tower/shared";
import { mistwoodScenery } from "../../../../src/visuals/levels/mistwood/scenery.js";
import { groundY } from "../../../../src/visuals/overworld/scenery.js";

const LEVEL: LevelLayout = {
  id: "test-wood", name: "Test Wood", floor: 1, theme: "mistwood", playerSpeed: 5,
  tiles: Array.from({ length: 30 }, () => ".".repeat(40)), campfires: [],
};
const { halfWidth: L, halfDepth: D } = mapHalfSize(LEVEL);
const MAP = { x: -L, z: -D, w: L * 2, h: D * 2 };

describe("Mistwood's 3D surroundings", () => {
  const scenery = mistwoodScenery(LEVEL);

  test("stand outside the map: what's on it comes from its tiles", () => {
    assert.ok(scenery.props.length > 0);
    for (const p of scenery.props) assert.ok(!inRect(MAP, p.x, p.z), `${p.kind} at ${p.x}, ${p.z}`);
  });

  test("the map is flat ground at height 0, with banks rising round it and dropping to the south", () => {
    for (let x = -L + 0.25; x < L; x += 0.5) {
      for (let z = -D + 0.25; z < D; z += 0.5) assert.equal(groundY(scenery.ledges, x, z), 0);
    }
    assert.ok(groundY(scenery.ledges, 0, D + 2) > 0);
    assert.ok(groundY(scenery.ledges, -L - 2, 0) > 0);
    assert.ok(groundY(scenery.ledges, L + 2, 0) > 0);
    assert.ok(groundY(scenery.ledges, 0, -D - 2) < 0);
  });

  test("every prop stands on the ground under it", () => {
    for (const p of scenery.props) assert.equal(p.y, groundY(scenery.ledges, p.x, p.z));
  });

  test("the same level always gets the same scenery", () => {
    assert.deepEqual(mistwoodScenery(LEVEL), scenery);
  });
});
