import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { tileAt, type Rect, type TileKind } from "@infinite-tower/shared";
import { chunkScenery, groundY, hidesWalker } from "../../../src/visuals/overworld/scenery.js";
import { testMap } from "../../fixtures/map.js";

const TOWN = testMap([
  "WWWWWWWWWWWWWWWWWWWW",
  "W;;;;;;;;;;;;;;;;;;W",
  "W;;FFFF;;;;PPPP;;;;W",
  "W;;;;;;;;;;;;;;;;;;W",
  "WHHC;;;;;HHHH;;;;AHW",
  "WHHC;;;;;HHHH;;;;AHW",
  "WHHC;;;;;HHHH;;;;AHW",
  "W;;;;;;;;;;;;;;;;;;W",
  "W;;;;;;;;;;;;;;;;;;W",
  "WWWWWWWWWWWWWWWWWWWW",
], "kingdom");
const STALLS: TileKind[] = ["foodStall", "potionStall", "changerStall", "forge"];

function tilesOf(map: typeof TOWN, kind: TileKind): { x: number; z: number }[] {
  const { bounds: b } = map, at: { x: number; z: number }[] = [];
  for (let x = b.x + 0.5; x < b.x + b.w; x++) for (let z = b.z + 0.5; z < b.z + b.h; z++) {
    if (tileAt(map, x, z) === kind) at.push({ x, z });
  }
  return at;
}

const inside = (r: Rect, x: number, z: number) => x > r.x && x < r.x + r.w && z > r.z && z < r.z + r.h;

describe("a chunk's scenery", () => {
  const scenery = chunkScenery(TOWN, TOWN.bounds), standing = scenery.ledges.slice(1);
  const under = (x: number, z: number) => standing.filter((l) => inside(l.rect, x, z));

  test("its first ledge is its own ground, at height 0, and everything else stands within it", () => {
    assert.deepEqual(scenery.ledges[0], { rect: TOWN.bounds, topY: 0 });
    for (const { rect } of standing) {
      assert.ok(rect.x >= TOWN.bounds.x && rect.x + rect.w <= TOWN.bounds.x + TOWN.bounds.w);
      assert.ok(rect.z >= TOWN.bounds.z && rect.z + rect.h <= TOWN.bounds.z + TOWN.bounds.h);
    }
  });

  test("each run of stall tiles is one built stall, so it looks whole from every side", () => {
    for (const kind of STALLS) {
      const tiles = tilesOf(TOWN, kind);
      assert.ok(tiles.length > 1, kind);
      const runs = new Set(tiles.flatMap(({ x, z }) => under(x, z)));
      assert.equal(runs.size, 1, kind);
      const [run] = runs;
      assert.equal(run!.rect.w * run!.rect.h, tiles.length, kind);
    }
  });

  test("the market stalls have an awning over the counter, the forge doesn't", () => {
    for (const kind of STALLS) {
      const [run] = under(tilesOf(TOWN, kind)[0]!.x, tilesOf(TOWN, kind)[0]!.z);
      if (kind === "forge") assert.equal(run!.awning, undefined);
      else assert.ok(run!.awning!.topY > run!.topY, kind);
    }
  });

  test("the stalls' goods stand on top of them", () => {
    for (const kind of STALLS) {
      for (const { x, z } of tilesOf(TOWN, kind)) {
        const goods = scenery.props.filter((p) => Math.floor(p.x) + 0.5 === x && Math.floor(p.z) + 0.5 === z);
        assert.equal(goods.length, 1, `${kind} at ${x}, ${z}`);
        assert.equal(goods[0]!.y, groundY(scenery.ledges, x, z));
        assert.ok(goods[0]!.y > 0);
      }
    }
  });

  test("a house cut by a chunk's edge stands as tall on both sides of it", () => {
    const [west, east] = [{ ...TOWN.bounds, w: 11 }, { ...TOWN.bounds, x: TOWN.bounds.x + 11, w: 9 }];
    const y = (rect: Rect, x: number) => groundY(chunkScenery(TOWN, rect).ledges, x, 0);
    assert.equal(y(west, 0.5), y(east, 1.5));
    assert.ok(y(west, 0.5) > 0);
  });

  test("castle masonry thick enough is its bulk, standing taller than a wall", () => {
    const keep = testMap(["WWWW....", "WWWW....", "WWWW....", "W......."], "kingdom");
    const ledges = chunkScenery(keep, keep.bounds).ledges;
    assert.ok(groundY(ledges, -3.5, 1.5) > groundY(ledges, -3.5, -1.5));
  });

  test("the same chunk always gets the same scenery", () => {
    assert.deepEqual(chunkScenery(TOWN, TOWN.bounds), scenery);
  });
});

describe("the quarry's cut stone", () => {
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
  const pit = testMap(ROWS, "quarry");
  const wider = testMap(["QQQQ".repeat(6), ...ROWS.map((r) => `QQQQ${r}QQQQ`), "QQQQ".repeat(6)], "quarry");
  wider.regions[0]!.area = pit.bounds;
  const { ledges } = chunkScenery(wider, wider.bounds), heightAt = (x: number, z: number) => groundY(ledges, x, z);
  const inset = (x: number, z: number) => Math.min(x + 8, 8 - x, z + 5, 5 - z);

  test("the quarry floor is flat at height 0, and every cut-stone tile stands up out of it", () => {
    for (let x = -7.5; x < 8; x++) {
      for (let z = -4.5; z < 5; z++) {
        if (tileAt(pit, x, z) === "cutStone") assert.ok(heightAt(x, z) > 0, `${x}, ${z}`);
        else assert.equal(heightAt(x, z), 0, `${x}, ${z}`);
      }
    }
  });

  test("it rises in terraces toward the edge, and climbs on past it, higher than its rim", () => {
    const stone: [number, number][] = [];
    for (let x = -7.5; x < 8; x++) for (let z = -4.5; z < 5; z++) if (tileAt(pit, x, z) === "cutStone") stone.push([x, z]);
    for (const [ax, az] of stone) {
      for (const [bx, bz] of stone) {
        if (inset(ax, az) < inset(bx, bz)) assert.ok(heightAt(ax, az) >= heightAt(bx, bz), `${ax},${az} vs ${bx},${bz}`);
      }
    }
    assert.ok(new Set(stone.map(([x, z]) => heightAt(x, z))).size >= 3);
    assert.ok(heightAt(0, 5.5) > heightAt(-7.5, 4.5));
  });
});

describe("hidesWalker", () => {
  const wall = { rect: { x: -2, z: 3, w: 4, h: 1 }, topY: 5 };
  const eye = { x: 0, y: 16, z: 14 }, feet = { x: 0, y: 0, z: 1 };

  test("a ledge between the camera and the walker hides them", () => {
    assert.equal(hidesWalker(wall, eye, feet), true);
  });

  test("one hiding only their feet or one side still counts", () => {
    assert.equal(hidesWalker({ rect: { x: -2, z: 2, w: 4, h: 1 }, topY: 1.5 }, eye, feet), true);
    assert.equal(hidesWalker({ rect: { x: 0.3, z: 2, w: 1.7, h: 1 }, topY: 5 }, eye, feet), true);
  });

  test("one behind the walker, beside them, or low enough to see over doesn't", () => {
    assert.equal(hidesWalker(wall, { x: 0, y: 16, z: -12 }, feet), false);
    assert.equal(hidesWalker({ ...wall, rect: { ...wall.rect, x: 5 } }, eye, feet), false);
    assert.equal(hidesWalker({ ...wall, topY: 1 }, eye, feet), false);
  });

  test("a stall's awning hides them, even over a counter low enough to see over", () => {
    const counter = { ...wall, topY: 1 };
    assert.equal(hidesWalker({ ...counter, awning: { colors: ["#fff", "#000"], topY: 5 } }, eye, feet), true);
  });
});
