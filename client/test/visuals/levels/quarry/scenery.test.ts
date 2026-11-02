import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inRect, mapHalfSize, tileAt, type LevelLayout } from "@infinite-tower/shared";
import { quarryScenery } from "../../../../src/visuals/levels/quarry/scenery.js";
import { groundY } from "../../../../src/visuals/overworld/scenery.js";

const ROWS = [
  "QQQQQQQQQQQQQQQQ",
  "QQQQQQQQQQQQQQQQ",
  "QQQQQ......QQQQQ",
  "QQQ..........QQQ",
  "QQ....QQQQ....QQ",
  "QQ....Q..Q....QQ",
  "QQ....QQQQ....QQ",
  "QQ............QQ",
  "QQQQQQQ..QQQQQQQ",
  "QQQQQQQ..QQQQQQQ",
];
const LEVEL: LevelLayout = {
  id: "test-quarry", name: "Test Quarry", floor: 1, theme: "quarry", playerSpeed: 5, tiles: ROWS, campfires: [],
  npcs: [], traces: [],
};
const { halfWidth: L, halfDepth: D } = mapHalfSize(LEVEL);
const MAP = { x: -L, z: -D, w: L * 2, h: D * 2 };
const tiles = ROWS.flatMap((row, r) => [...row].map((_, c) => ({ x: c - L + 0.5, z: D - r - 0.5, c, r })));
const inset = ({ c, r }: { c: number; r: number }) => Math.min(c, r, ROWS[0]!.length - 1 - c, ROWS.length - 1 - r);

describe("the Old Quarry's 3D cut stone", () => {
  const scenery = quarryScenery(LEVEL);
  const heightAt = (x: number, z: number) => groundY(scenery.ledges, x, z);

  test("the quarry floor is flat at height 0, and every cut-stone tile stands up out of it", () => {
    for (const t of tiles) {
      if (tileAt(LEVEL, t.x, t.z) === "cutStone") assert.ok(heightAt(t.x, t.z) > 0, `${t.c}, ${t.r}`);
      else assert.equal(heightAt(t.x, t.z), 0, `${t.c}, ${t.r}`);
    }
  });

  test("it rises in terraces toward the edge: cut stone further in stands no higher than stone further out", () => {
    const stone = tiles.filter((t) => tileAt(LEVEL, t.x, t.z) === "cutStone");
    for (const a of stone) {
      for (const b of stone) {
        if (inset(a) < inset(b)) assert.ok(heightAt(a.x, a.z) >= heightAt(b.x, b.z), `${a.c},${a.r} vs ${b.c},${b.r}`);
      }
    }
    const heights = new Set(stone.map((t) => heightAt(t.x, t.z)));
    assert.ok(heights.size >= 3);
  });

  test("the quarry's walls climb on past the map, higher than its rim", () => {
    const rim = heightAt(-L + 0.5, D - 0.5);
    for (const [x, z] of [[0, D + 2], [-L - 2, 0], [L + 2, 0], [-L + 2, -D - 2]] as const) {
      assert.ok(heightAt(x, z) > rim, `${x}, ${z}`);
    }
  });

  test("its props stand on the ground under them: outside the map, or on the map's cut stone", () => {
    assert.ok(scenery.props.length > 0);
    for (const p of scenery.props) {
      assert.ok(!inRect(MAP, p.x, p.z) || tileAt(LEVEL, p.x, p.z) === "cutStone", `${p.kind} at ${p.x}, ${p.z}`);
      assert.equal(p.y, groundY(scenery.ledges, p.x, p.z));
    }
  });

  test("the same level always gets the same scenery", () => {
    assert.deepEqual(quarryScenery(LEVEL), scenery);
  });
});
