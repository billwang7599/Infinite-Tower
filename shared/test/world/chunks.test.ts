import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  chunkData, chunksNear, CHUNK_TILES, dropChunk, emptyTiles, putChunk, tileAt, waterFlow, type Flow, type WorldMap,
} from "@infinite-tower/shared";

// 32 x 32 tiles, x and z from -16 to 16: four chunks, a river down x 0 to 1 and the south-west one empty.
const ROWS = Array.from({ length: 32 }, (_, r) => {
  const row = "TTTTTTTTTTTTTTTT.....o..........";
  const left = r >= 16 ? " ".repeat(16) : row.slice(0, 16);
  return `${left}${row.slice(16)}`.split("").map((ch, c) => (c === 16 || c === 17 ? "~" : ch)).join("");
});
const MAP: WorldMap = {
  bounds: { x: -16, z: -16, w: 32, h: 32 }, tiles: ROWS, playerSpeed: 5, campfires: [],
  regions: [{ id: "test", name: "Test", theme: "grass-field", area: { x: -16, z: -16, w: 32, h: 32 } }],
};
const FLOW = waterFlow(MAP);
const ALL = chunksNear(MAP.bounds, 0, 0, 100);

describe("chunksNear", () => {
  test("every chunk of the map within the radius of the point, measured to its nearest edge", () => {
    assert.equal(ALL.length, 4);
    assert.deepEqual(chunksNear(MAP.bounds, 8, 8, 1), [{ x: 0, z: 0, w: CHUNK_TILES, h: CHUNK_TILES }]);
    assert.equal(chunksNear(MAP.bounds, 8, 8, 8).length, 3, "the far corner is 8√2 off");
  });
});

describe("a chunk sent and put", () => {
  test("puts back the same tiles and currents, chunk by chunk, onto an empty map", () => {
    const got: WorldMap = { ...MAP, tiles: emptyTiles(MAP.bounds) }, flow = new Map<string, Flow>();
    for (const rect of ALL) putChunk(got, flow, chunkData(MAP, FLOW, rect));
    assert.deepEqual(got.tiles, MAP.tiles);
    assert.equal(flow.size, FLOW.size);
    for (const [key, f] of FLOW) {
      const g = flow.get(key)!;
      assert.ok(Math.abs(g.u - f.u) < 1e-3 && Math.abs(g.v - f.v) < 1e-3 && g.runs === f.runs, key);
    }
  });

  test("an all-void chunk is sent with no rows", () => {
    assert.equal(chunkData(MAP, FLOW, { x: -16, z: -16, w: 16, h: 16 }).rows, null);
  });

  test("a dropped chunk is void again, its currents gone", () => {
    const got: WorldMap = { ...MAP, tiles: [...MAP.tiles] }, flow = new Map(FLOW);
    dropChunk(got, flow, { x: 0, z: 0, w: 16, h: 16 });
    assert.equal(tileAt(got, 0.5, 0.5), null);
    assert.equal(tileAt(got, 0.5, -0.5), "water");
    assert.ok([...flow.keys()].every((k) => Number(k.split(",")[1]) < 0));
  });
});
