import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { campfireLights, tileLooksOf, REGION_LOOKS } from "../../../src/visuals/regions/index.js";
import { testMap } from "../../fixtures/map.js";

const MAP = testMap(["...."], "grass-field", { campfires: [{ x: 2, z: -3 }, { x: -5, z: 4 }] });

describe("campfireLights", () => {
  test("each campfire is a warm, flickering map light standing over it", () => {
    const lights = campfireLights(MAP);
    assert.equal(lights.length, MAP.campfires.length);
    lights.forEach((light, i) => {
      assert.equal(light.at.x, MAP.campfires[i]!.x);
      assert.equal(light.at.z, MAP.campfires[i]!.z);
      assert.ok(light.at.y > 0);
      assert.ok(light.color.r > light.color.b);
      assert.ok(light.flicker > 0 && light.rangeM > 0 && light.intensity > 0);
    });
  });
});

describe("tileLooksOf", () => {
  test("each tile in the look of its region, and past every region the nearest one's", () => {
    const map = testMap(["....", "...."], "grass-field");
    map.regions.push({ id: "wood", name: "Wood", theme: "mistwood", area: { x: 2, z: -1, w: 2, h: 2 } });
    map.regions[0]!.area = { x: -2, z: -1, w: 4, h: 2 };
    const looks = tileLooksOf(map);
    assert.equal(looks(-1, 0), REGION_LOOKS["grass-field"].tiles);
    assert.equal(looks(2, 0), REGION_LOOKS.mistwood.tiles);
    assert.equal(looks(9, 0), REGION_LOOKS.mistwood.tiles);
  });
});
