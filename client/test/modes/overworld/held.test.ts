import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chunkData, chunksNear, CHUNK_DROP_TILES, emptyTiles, tileAt, waterFlow } from "@infinite-tower/shared";
import { dropFar, hold, nothingHeld } from "../../../src/modes/overworld/held.js";
import { testMap } from "../../fixtures/map.js";

// 64 x 32: four chunks across, two down, a pond in the west.
const FULL = testMap(Array.from({ length: 32 }, (_, r) => (r === 20 ? "..~~" : "....") + ".".repeat(60)));
const FLOW = waterFlow(FULL);
const ALL = chunksNear(FULL.bounds, 0, 0, Infinity).map((rect) => chunkData(FULL, FLOW, rect));

describe("the chunks held", () => {
  test("what comes in fills the map and the water's currents, each change counted", () => {
    const map = { ...FULL, tiles: emptyTiles(FULL.bounds) }, held = nothingHeld();
    hold(map, held, ALL);
    assert.deepEqual(map.tiles, FULL.tiles);
    assert.equal(held.flow.size, FLOW.size);
    assert.equal(held.keys.size, ALL.length);
    assert.equal(held.revision, 1);
  });

  test("those further than CHUNK_DROP_TILES are dropped: void again, the rest kept", () => {
    const map = { ...FULL, tiles: emptyTiles(FULL.bounds) }, held = nothingHeld();
    hold(map, held, ALL);
    const east = { x: 32 + CHUNK_DROP_TILES - 1, z: 0 };
    dropFar(map, held, east);
    assert.equal(tileAt(map, -31.5, 0.5), null, "the west end is gone");
    assert.equal(tileAt(map, 31.5, 0.5), "grass", "the east end is kept");
    assert.equal(held.flow.size, 0, "and its pond");
    assert.ok(held.revision > 1);
  });
});
