import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inRect, inTallGrass, type LevelLayout } from "@infinite-tower/shared";
import { grassFieldScenery } from "../../../../src/visuals/levels/grass-field/scenery.js";
import { groundY, isTall, walkable } from "../../../../src/visuals/overworld3d/scenery.js";

const LEVEL: LevelLayout = {
  id: "test-field", name: "Test Field", theme: "grass-field", halfWidth: 20, halfDepth: 13, border: 1.6,
  playerSpeed: 5, grass: [{ x: 3, z: 1, w: 11, h: 7 }], campfires: [{ x: -9, z: -2.5 }],
};

describe("the Grass Field's 3D scenery", () => {
  const scenery = grassFieldScenery(LEVEL);
  const area = walkable(LEVEL);

  test("nothing that stands up like an obstacle is placed where you can walk", () => {
    const tall = scenery.props.filter((p) => isTall(p.kind));
    assert.ok(tall.length > 0);
    for (const p of tall) assert.ok(!inRect(area, p.x, p.z), `${p.kind} at ${p.x}, ${p.z}`);
  });

  test("where you can walk is flat ground at height 0", () => {
    for (let x = area.x; x <= area.x + area.w; x += 0.5) {
      for (let z = area.z; z <= area.z + area.h; z += 0.5) assert.equal(groundY(scenery.ledges, x, z), 0);
    }
  });

  test("cliffs rise round the level and drop away to the south", () => {
    const { halfWidth: L, halfDepth: D } = LEVEL;
    assert.ok(groundY(scenery.ledges, 0, D + 8) > 0);
    assert.ok(groundY(scenery.ledges, -L - 2, 0) > 0);
    assert.ok(groundY(scenery.ledges, L + 2, 0) > 0);
    assert.ok(groundY(scenery.ledges, 0, -D - 2) < 0);
  });

  test("every prop stands on the ground under it", () => {
    for (const p of scenery.props) assert.equal(p.y, groundY(scenery.ledges, p.x, p.z));
  });

  test("tall grass is drawn only in the tall-grass patches", () => {
    const tallGrass = scenery.props.filter((p) => p.kind === "tallGrass");
    assert.ok(tallGrass.length > 0);
    for (const p of tallGrass) assert.ok(inTallGrass(LEVEL, p.x, p.z));
  });

  test("the same level always gets the same scenery", () => {
    assert.deepEqual(grassFieldScenery(LEVEL), scenery);
  });
});
