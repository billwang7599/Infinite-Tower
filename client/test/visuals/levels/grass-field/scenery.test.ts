import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inRect, mapHalfSize, type LevelLayout } from "@infinite-tower/shared";
import { grassFieldScenery } from "../../../../src/visuals/levels/grass-field/scenery.js";
import { groundY } from "../../../../src/visuals/overworld/scenery.js";

const LEVEL: LevelLayout = {
  id: "test-field", name: "Test Field", floor: 1, theme: "grass-field", playerSpeed: 5,
  tiles: Array.from({ length: 26 }, () => ".".repeat(40)), campfires: [{ x: -9, z: -2.5 }], npcs: [], traces: [],
};
const { halfWidth: L, halfDepth: D } = mapHalfSize(LEVEL);
const MAP = { x: -L, z: -D, w: L * 2, h: D * 2 };

describe("the Grass Field's 3D surroundings", () => {
  const scenery = grassFieldScenery(LEVEL);

  test("stand outside the map: what's on it comes from its tiles", () => {
    assert.ok(scenery.props.length > 0);
    for (const p of scenery.props) assert.ok(!inRect(MAP, p.x, p.z), `${p.kind} at ${p.x}, ${p.z}`);
  });

  test("the map is flat ground at height 0", () => {
    for (let x = -L + 0.25; x < L; x += 0.5) {
      for (let z = -D + 0.25; z < D; z += 0.5) assert.equal(groundY(scenery.ledges, x, z), 0);
    }
  });

  test("cliffs rise round the level and drop away to the south", () => {
    assert.ok(groundY(scenery.ledges, 0, D + 8) > 0);
    assert.ok(groundY(scenery.ledges, -L - 2, 0) > 0);
    assert.ok(groundY(scenery.ledges, L + 2, 0) > 0);
    assert.ok(groundY(scenery.ledges, 0, -D - 2) < 0);
  });

  test("every prop stands on the ground under it", () => {
    for (const p of scenery.props) assert.equal(p.y, groundY(scenery.ledges, p.x, p.z));
  });

  test("the same level always gets the same scenery", () => {
    assert.deepEqual(grassFieldScenery(LEVEL), scenery);
  });
});
