import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { tileAt, type LevelLayout } from "@infinite-tower/shared";
import { WATER_DEPTH_TILES, waterMap } from "../../../src/modes/overworld/water.js";

const level = (tiles: string[]): LevelLayout => ({
  id: "test", name: "Test", floor: 1, theme: "grass-field", playerSpeed: 5, campfires: [], npcs: [], tiles,
});

// 14 x 16, centred on 0, 0: a river 2 wide (x -1 to 1) from the north, under a bridge (z 3 to 4), into a lake with
// a dead-end nook on its east side (x 5 to 6, z -4 to -3).
const RIVER_INTO_LAKE = level([
  "TTTTTTTTTTTTTT",
  "T.....~~.....T",
  "T.....~~.....T",
  "T.....~~.....T",
  "T:::::==:::::T",
  "T.....~~.....T",
  "T.....~~.....T",
  "T.....~~.....T",
  "T...~~~~~~...T",
  "T..~~~~~~~~..T",
  "T.~~~~~~~~~~.T",
  "T.~~~~~~~~~~~T",
  "T.~~~~~~~~~~.T",
  "T..~~~~~~~~..T",
  "T...~~~~~~...T",
  "TTTTTTTTTTTTTT",
]);

const speed = (p: { flowX: number; flowZ: number }) => Math.hypot(p.flowX, p.flowZ);

describe("waterMap", () => {
  const water = waterMap(RIVER_INTO_LAKE);

  test("has every water tile, by its south-west corner", () => {
    assert.equal(water.tiles.length, 6 + 6 + 6 + 8 + 10 * 3 + 1 + 8 + 6);
    for (const t of water.tiles) assert.equal(tileAt(RIVER_INTO_LAKE, t.x + 0.5, t.z + 0.5), "water");
  });

  test("the river runs straight downstream, from its first row, on both sides of the bridge", () => {
    for (const z of [6.5, 5, 4.5, 2.5, 1.5, 0.5]) {
      const p = water.at(0, z);
      assert.ok(p.flowZ < 0, `south at z ${z}: ${p.flowZ}`);
      assert.ok(Math.abs(p.flowX) < Math.abs(p.flowZ) / 10, `straight down at z ${z}: ${p.flowX}`);
    }
  });

  test("it slows as it widens into the lake, spreading out from the river's mouth", () => {
    const river = water.at(0, 1.5), lake = water.at(0, -3.5);
    assert.ok(speed(lake) > 0, "the lake still drifts");
    assert.ok(speed(lake) < speed(river) / 2, `${speed(lake)} against ${speed(river)}`);
    assert.ok(water.at(-3, -1.5).flowX < 0 && water.at(3, -1.5).flowX > 0, "west on the west side, east on the east");
  });

  test("a dead-end nook barely moves, slower than the open lake", () => {
    assert.ok(speed(water.at(5.5, -3.5)) < speed(water.at(0, -3.5)) / 4, `${speed(water.at(5.5, -3.5))}`);
  });

  test("it runs slower at the bank than in the middle", () => {
    assert.ok(speed(water.at(-0.95, 1.5)) < speed(water.at(0, 1.5)));
  });

  test("the shore is how far land is: 0 on the bank, 1 in the middle of a river 2 tiles wide", () => {
    assert.equal(water.at(-1, 1.5).shore, 0);
    assert.equal(water.at(1, 2.5).shore, 0);
    assert.ok(Math.abs(water.at(0, 1.5).shore - 1) < 1e-9);
    assert.ok(water.at(0, -3.5).shore > 3);
  });

  test("the bed drops from the bank's depth to the deepest, never past it", () => {
    assert.equal(water.at(-1, 1.5).depth, WATER_DEPTH_TILES.bank);
    const river = water.at(0, 1.5).depth, lake = water.at(0, -3.5).depth;
    assert.ok(river > WATER_DEPTH_TILES.bank && lake > river, `${river}, ${lake}`);
    assert.ok(lake <= WATER_DEPTH_TILES.deep);
  });

  test("a bank on every side where water meets land (the bridge too), facing that land", () => {
    const sides = water.tiles.reduce((n, t) => n + [[0, 1], [0, -1], [-1, 0], [1, 0]]
      .filter(([dx, dz]) => tileAt(RIVER_INTO_LAKE, t.x + 0.5 + dx!, t.z + 0.5 + dz!) !== "water").length, 0);
    assert.equal(water.banks.length, sides);
    for (const b of water.banks) {
      const midX = (b.from.x + b.to.x) / 2, midZ = (b.from.z + b.to.z) / 2;
      assert.equal(Math.hypot(b.to.x - b.from.x, b.to.z - b.from.z), 1);
      assert.equal(tileAt(RIVER_INTO_LAKE, midX + b.toLand.x / 2, midZ + b.toLand.z / 2) === "water", false);
      assert.equal(tileAt(RIVER_INTO_LAKE, midX - b.toLand.x / 2, midZ - b.toLand.z / 2), "water");
    }
    assert.ok(water.banks.some((b) => b.from.z === 3 && b.toLand.z === 1), "under the bridge's south side");
  });

  test("water no wider anywhere runs south, then east, all of it the same way", () => {
    const southward = waterMap(level(["T~~T", "T~~T", "T~~T", "T~~T", "T~~T", "T~~T"]));
    for (const z of [2.5, 0, -2.5]) {
      const p = southward.at(0, z);
      assert.ok(p.flowZ < 0 && Math.abs(p.flowX) < -p.flowZ / 10, `${p.flowX}, ${p.flowZ} at z ${z}`);
    }
    const eastward = waterMap(level(["TTTTTT", "~~~~~~", "~~~~~~", "TTTTTT"]));
    for (const x of [-2.5, 0, 2.5]) {
      const p = eastward.at(x, 0);
      assert.ok(p.flowX > 0 && Math.abs(p.flowZ) < p.flowX / 10, `${p.flowX}, ${p.flowZ} at x ${x}`);
    }
  });

  test("a level with no water has none", () => {
    const dry = waterMap(level(["....", "...."]));
    assert.deepEqual([dry.tiles, dry.banks], [[], []]);
  });
});
