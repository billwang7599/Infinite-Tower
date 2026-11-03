import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CHUNK_TILES } from "@infinite-tower/shared";
import { chunksOf } from "../../../src/visuals/overworld/chunks.js";
import { testMap } from "../../fixtures/map.js";

describe("chunksOf", () => {
  test("cuts the map into chunks, leaving out those with nothing in them", () => {
    const rows = Array.from({ length: 32 }, (_, r) => (r < 16 ? "." : " ").repeat(16) + " ".repeat(16));
    const map = testMap(rows);
    assert.deepEqual(chunksOf(map), [{ x: -16, z: 0, w: CHUNK_TILES, h: CHUNK_TILES }]);
  });
});
