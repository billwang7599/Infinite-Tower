import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inTallGrass, isSolid, mapHalfSize, tileAt, TILES, type TileKind } from "@infinite-tower/shared";
import { TEST_LAYOUT as level } from "./level.js";

describe("tiles", () => {
  test("the map is centred: its half size comes from the grid", () => {
    assert.deepEqual(mapHalfSize(level), { halfWidth: 10, halfDepth: 5 });
  });

  test("tileAt reads the grid, the first row the northern edge (+z)", () => {
    assert.equal(tileAt(level, -2.5, 3.5), "rock");
    assert.equal(tileAt(level, -2.5, 0.5), "grass");
    assert.equal(tileAt(level, 2.5, 0.5), "tallGrass");
    assert.equal(tileAt(level, 5.9, -0.9), "tallGrass");
    assert.equal(tileAt(level, 6.1, -0.9), "grass");
    assert.equal(tileAt(level, -9.9, 4.9), "grass");
    assert.equal(tileAt(level, 9.9, -4.9), "grass");
  });

  test("outside the map there is no tile, and it counts as solid", () => {
    assert.equal(tileAt(level, -10.1, 0), null);
    assert.equal(tileAt(level, 0, 5.1), null);
    assert.equal(isSolid(level, 10.1, 0), true);
    assert.equal(isSolid(level, 0, -5.1), true);
  });

  test("isSolid and inTallGrass follow the kind's rules", () => {
    assert.equal(isSolid(level, -2.5, 2), true);
    assert.equal(isSolid(level, 0, 0), false);
    assert.equal(inTallGrass(level, 3, 0), true);
    assert.equal(inTallGrass(level, 0, 0), false);
    assert.equal(inTallGrass(level, -2.5, 2), false);
  });

  test("every kind has its own character", () => {
    const chars = Object.values(TILES).map((t) => t.char);
    assert.equal(new Set(chars).size, chars.length);
  });

  test("trees, rocks, water and ruin walls block; paths, bridges, flowers, tall grass and pads don't", () => {
    const blocks = (k: TileKind) => TILES[k].solid;
    for (const k of ["tree", "rock", "water", "ruinWall"] as const) assert.equal(blocks(k), true, k);
    for (const k of ["grass", "path", "bridge", "flowers", "tallGrass", "ruinFloor", "pad"] as const) {
      assert.equal(blocks(k), false, k);
    }
  });
});
