import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inRect, mapHalfSize, type LevelLayout } from "@infinite-tower/shared";
import { grassFieldScenery } from "../../../src/visuals/levels/grass-field/scenery.js";
import { groundY, openExits, SCENERY_REACH_TILES } from "../../../src/visuals/overworld/scenery.js";

const WIDTH = 40, DEPTH = 26;
const closed = Array.from({ length: DEPTH }, (_, r) =>
  r === 0 || r === DEPTH - 1 ? "T".repeat(WIDTH) : `T${".".repeat(WIDTH - 2)}T`);
const level = (tiles: string[]): LevelLayout => ({
  id: "test", name: "Test", floor: 1, theme: "grass-field", playerSpeed: 5, tiles, campfires: [], npcs: [], traces: [],
});
const open = (rows: string[], at: (r: number, c: number) => boolean) =>
  rows.map((row, r) => [...row].map((ch, c) => (at(r, c) ? ":" : ch)).join(""));

const CLOSED = level(closed);
const { halfWidth: L, halfDepth: D } = mapHalfSize(CLOSED);
// Rows 10-12 open on the east edge: z from D - 13 to D - 10. Columns 5-6 open on the north edge.
const EAST_GAP = { x: L, z: D - 13, w: SCENERY_REACH_TILES, h: 3 };
const NORTH_GAP = { x: 5 - L, z: D, w: 2, h: SCENERY_REACH_TILES };
const OPENED = level(open(closed, (r, c) => (c === WIDTH - 1 && r >= 10 && r <= 12) || (r === 0 && (c === 5 || c === 6))));

describe("openExits", () => {
  test("leaves a level with a closed edge as it was", () => {
    const scenery = grassFieldScenery(CLOSED);
    assert.deepEqual(openExits(scenery, CLOSED), scenery);
  });

  test("cuts a way out level with the map in front of each open stretch of the edge", () => {
    const opened = openExits(grassFieldScenery(OPENED), OPENED);
    for (const gap of [EAST_GAP, NORTH_GAP]) {
      for (let x = gap.x + 0.25; x < gap.x + gap.w; x += 0.5) {
        for (let z = gap.z + 0.25; z < gap.z + gap.h; z += 0.5) assert.equal(groundY(opened.ledges, x, z), 0);
      }
    }
  });

  test("keeps the ground beside the way out as it was", () => {
    const scenery = grassFieldScenery(OPENED), opened = openExits(scenery, OPENED);
    for (const [x, z] of [[L + 5, EAST_GAP.z - 1], [L + 5, EAST_GAP.z + EAST_GAP.h + 1], [-L - 4, 0], [0, -D - 3]]) {
      assert.equal(groundY(opened.ledges, x!, z!), groundY(scenery.ledges, x!, z!), `${x}, ${z}`);
    }
    assert.ok(groundY(opened.ledges, L + 5, EAST_GAP.z - 1) > 0);
  });

  test("clears the way out of props", () => {
    const opened = openExits(grassFieldScenery(OPENED), OPENED);
    for (const p of opened.props) {
      for (const gap of [EAST_GAP, NORTH_GAP]) assert.ok(!inRect(gap, p.x, p.z), `${p.kind} at ${p.x}, ${p.z}`);
    }
  });
});
