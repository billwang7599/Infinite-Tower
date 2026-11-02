import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { tileAt, type LevelLayout } from "@infinite-tower/shared";
import { WATER_DEPTH_TILES, waterMap, type WaterMap } from "../../../src/modes/overworld/water.js";

const level = (tiles: string[]): LevelLayout => ({
  id: "test", name: "Test", floor: 1, theme: "grass-field", playerSpeed: 5, campfires: [], npcs: [], traces: [], tiles,
});

// 16 x 16, centred on 0, 0: a river 2 wide (x -1 to 1) in from the map's north edge, under a bridge (z 4 to 5),
// through a lake with a dead-end nook on its east side (x 5 to 6, z -2 to -1), and out through the trees to the south.
const RIVER_THROUGH_LAKE = level([
  "TTTTTTT~~TTTTTTT",
  ".......~~.......",
  ".......~~.......",
  ":::::::==:::::::",
  ".......~~.......",
  ".......~~.......",
  ".....~~~~~~.....",
  "....~~~~~~~~....",
  "...~~~~~~~~~~...",
  "...~~~~~~~~~~~..",
  "...~~~~~~~~~~...",
  "....~~~~~~~~....",
  ".....~~~~~~.....",
  ".......~~.......",
  "TTTTTTT~~TTTTTTT",
  "TTTTTTTTTTTTTTTT",
]);

// 8 x 8: a pond against the west trees in one place (x -3, z -1 to 0).
const POND = level([
  "TTTTTTTT",
  "T......T",
  "T.~~~..T",
  "T.~~~~.T",
  "T~~~~~.T",
  "T.~~~~.T",
  "T......T",
  "TTTTTTTT",
]);

const speed = (p: { flowX: number; flowZ: number }) => Math.hypot(p.flowX, p.flowZ);

function everywhere(map: WaterMap, check: (p: ReturnType<WaterMap["at"]>, x: number, z: number) => void): void {
  for (const t of map.tiles) {
    for (const [dx, dz] of [[0, 0], [0.5, 0.5], [1, 0.25], [0.25, 1]] as const) {
      check(map.at(t.x + dx, t.z + dz), t.x + dx, t.z + dz);
    }
  }
}

describe("waterMap", () => {
  const water = waterMap(RIVER_THROUGH_LAKE);

  test("has every water tile, by its south-west corner", () => {
    assert.equal(water.tiles.length, 2 * 5 + 6 + 8 + 10 + 11 + 10 + 8 + 6 + 2 * 2);
    for (const t of water.tiles) assert.equal(tileAt(RIVER_THROUGH_LAKE, t.x + 0.5, t.z + 0.5), "water");
  });

  test("a river off the map at both ends runs straight from one to the other, on both sides of the bridge", () => {
    for (const z of [7.5, 6.5, 5.5, 3.5, 2.5, -5.5, -6.5]) {
      const p = water.at(0, z);
      assert.ok(p.flowZ < 0, `south at z ${z}: ${p.flowZ}`);
      assert.ok(Math.abs(p.flowX) < Math.abs(p.flowZ) / 10, `straight down at z ${z}: ${p.flowX}`);
    }
  });

  test("it slows as it widens into the lake, spreading out from where the river comes in", () => {
    const river = water.at(0, 2.5), lake = water.at(0, -1.5);
    assert.ok(speed(lake) > 0, "the lake still drifts");
    assert.ok(speed(lake) < speed(river) / 2, `${speed(lake)} against ${speed(river)}`);
    assert.ok(water.at(-3, 0.5).flowX < 0 && water.at(3, 0.5).flowX > 0, "west on the west side, east on the east");
  });

  test("a dead-end nook barely moves, slower than the open lake", () => {
    assert.ok(speed(water.at(5.5, -1.5)) < speed(water.at(0, -1.5)) / 4, `${speed(water.at(5.5, -1.5))}`);
  });

  test("but every bit of a river moves, so none of it gets the rings still water does", () => {
    everywhere(water, (p, x, z) => assert.ok(speed(p) > 0, `at ${x}, ${z}`));
  });

  test("it runs slower at the bank than in the middle", () => {
    assert.ok(speed(water.at(-0.95, 2.5)) < speed(water.at(0, 2.5)));
  });

  test("the shore is how far land is: 0 on the bank, 1 in the middle of a river 2 tiles wide", () => {
    assert.equal(water.at(-1, 2.5).shore, 0);
    assert.equal(water.at(1, 5.5).shore, 0);
    assert.ok(Math.abs(water.at(0, 2.5).shore - 1) < 1e-9);
    assert.ok(water.at(0, -1.5).shore > 3);
  });

  test("the bed drops from the bank's depth to the deepest, never past it", () => {
    assert.equal(water.at(-1, 2.5).depth, WATER_DEPTH_TILES.bank);
    const river = water.at(0, 2.5).depth, lake = water.at(0, -1.5).depth;
    assert.ok(river > WATER_DEPTH_TILES.bank && lake > river, `${river}, ${lake}`);
    assert.ok(lake <= WATER_DEPTH_TILES.deep);
  });

  test("a bank on every side where water meets land (the bridge too), facing that land", () => {
    const sides = water.tiles.reduce((n, t) => n + [[0, 1], [0, -1], [-1, 0], [1, 0]]
      .filter(([dx, dz]) => tileAt(RIVER_THROUGH_LAKE, t.x + 0.5 + dx!, t.z + 0.5 + dz!) !== "water").length, 0);
    assert.equal(water.banks.length, sides);
    for (const b of water.banks) {
      const midX = (b.from.x + b.to.x) / 2, midZ = (b.from.z + b.to.z) / 2;
      assert.equal(Math.hypot(b.to.x - b.from.x, b.to.z - b.from.z), 1);
      assert.equal(tileAt(RIVER_THROUGH_LAKE, midX + b.toLand.x / 2, midZ + b.toLand.z / 2) === "water", false);
      assert.equal(tileAt(RIVER_THROUGH_LAKE, midX - b.toLand.x / 2, midZ - b.toLand.z / 2), "water");
    }
    assert.ok(water.banks.some((b) => b.from.z === 4 && b.toLand.z === 1), "under the bridge's south side");
  });

  test("a river runs from its north end to its south end, or else from west to east", () => {
    const southward = waterMap(level(["TT~~TT", "..~~..", "..~~..", "..~~..", "..~~..", "TT~~TT"]));
    for (const z of [2.5, 0, -2.5]) {
      const p = southward.at(0, z);
      assert.ok(p.flowZ < 0 && Math.abs(p.flowX) < -p.flowZ / 10, `${p.flowX}, ${p.flowZ} at z ${z}`);
    }
    const eastward = waterMap(level(["TTTTTT", "T....T", "~~~~~~", "~~~~~~", "T....T", "TTTTTT"]));
    for (const x of [-2.5, 0, 2.5]) {
      const p = eastward.at(x, 0);
      assert.ok(p.flowX > 0 && Math.abs(p.flowZ) < p.flowX / 10, `${p.flowX}, ${p.flowZ} at x ${x}`);
    }
  });

  test("a river cut in two by a bridge is one river, both pieces flowing the same way", () => {
    // Widest just under the bridge, so the piece below would have no reason of its own to run south.
    const split = waterMap(level(["TT~~TT", "..~~..", "::==::", "..~~..", ".~~~~.", ".~~~~.", "..~~..", "..~~..",
      "..~~..", "..~~..", "..~~..", "TT~~TT"]));
    for (const z of [5.5, 4.5, 2.5, 1, -2.5, -4.5, -5.5]) {
      const p = split.at(0, z);
      assert.ok(p.flowZ < 0 && Math.abs(p.flowX) < -p.flowZ / 10, `${p.flowX}, ${p.flowZ} at z ${z}`);
    }
  });

  test("a lake with nowhere to run off to lies still", () => {
    const lake = waterMap(level(["......", ".~~~..", ".~~~~.", "..~~~.", "......", "......"]));
    assert.ok(lake.tiles.length > 0);
    everywhere(lake, (p, x, z) => assert.equal(speed(p), 0, `at ${x}, ${z}`));
  });

  test("so does a pond against the edge in only one place: water has to come in at one and leave by another", () => {
    everywhere(waterMap(POND), (p, x, z) => assert.equal(speed(p), 0, `at ${x}, ${z}`));
  });

  test("running water is every water tile of a body that runs off the map; the rest is still", () => {
    assert.deepEqual([water.running, water.still], [water.tiles, []]);
    const pond = waterMap(POND);
    assert.deepEqual([pond.running, pond.still], [[], pond.tiles]);
  });

  test("a level with no water has none", () => {
    const dry = waterMap(level(["....", "...."]));
    assert.deepEqual([dry.tiles, dry.running, dry.still, dry.banks], [[], [], [], []]);
  });
});
