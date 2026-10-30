import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { LevelLayout } from "@infinite-tower/shared";
import { campfireLights } from "../../../src/visuals/levels/index.js";

const LEVEL: LevelLayout = {
  id: "test", name: "Test", floor: 1, theme: "grass-field", playerSpeed: 5,
  campfires: [{ x: 2, z: -3 }, { x: -5, z: 4 }], npcs: [], tiles: ["...."],
};

describe("campfireLights", () => {
  test("each campfire is a warm, flickering map light standing over it", () => {
    const lights = campfireLights(LEVEL);
    assert.equal(lights.length, LEVEL.campfires.length);
    lights.forEach((light, i) => {
      assert.equal(light.at.x, LEVEL.campfires[i]!.x);
      assert.equal(light.at.z, LEVEL.campfires[i]!.z);
      assert.ok(light.at.y > 0);
      assert.ok(light.color.r > light.color.b);
      assert.ok(light.flicker > 0 && light.rangeM > 0 && light.intensity > 0);
    });
  });
});
