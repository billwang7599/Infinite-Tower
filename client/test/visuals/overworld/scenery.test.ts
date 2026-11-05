import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isSolid, tileAt, type Rect, type TileKind } from "@infinite-tower/shared";
import { chunkScenery, groundY, hidesWalker, type Ledge } from "../../../src/visuals/overworld/scenery.js";
import { CASTLE_HALLS, crenelsOf, LOT_TILES, type Side } from "../../../src/visuals/overworld/town.js";
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
  "W;;BBB;;;;;;;;;;;;;W",
  "WWWWWWWWWWWWWWWWWWWW",
], "kingdom");
const STALLS: TileKind[] = ["foodStall", "potionStall", "changerStall", "butcherStall", "forge"];

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


  test("castle masonry thick enough is its bulk, standing taller than a wall", () => {
    const keep = testMap(["WWWW....", "WWWW....", "WWWW....", "W......."], "kingdom");
    const ledges = chunkScenery(keep, keep.bounds).ledges;
    assert.ok(groundY(ledges, -3.5, 1.5) > groundY(ledges, -3.5, -1.5));
  });

  test("the same chunk always gets the same scenery", () => {
    assert.deepEqual(chunkScenery(TOWN, TOWN.bounds), scenery);
  });
});

describe("Highmere's buildings", () => {
  const CITY = testMap([
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "W;;;;;;;;;;;;;;;;;;;;;;;;;;W",
    "W;HHHHHHHHHHHHHH;;HHHHHHHH;W",
    "W;HHHHHHHHHHHHHH;;HHHHHHHH;W",
    "W;HHHHHHHHHHHHHH;;HHHHHHHH;W",
    "W;HHHHHHHHHHHHHH;;HHHHHHHH;W",
    "W;HHHHHHHHHHHHHH;;;;;;;;;;;W",
    "W;HHHHHHHHHHHHHH;;;HHHHHH;;W",
    "W;HHHHHHHHHHHHHH;;;H____H;;W",
    "W;;;;;;;;;;;;;;;;;;H____H;;W",
    "W;,,,,,,,,,,;;;;;;;HH__HH;;W",
    "W;,UUUU,SS,,;;L;;;;;;;;;;;;W",
    "W;,UUUU,SS,,;;;;;;;;;;;;;;;W",
    "W;,UUUU,,,,,;;;;;;;++W++;;;W",
    "W;,UUUU,,,,,;;L;;;;;+++++;;W",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  ], "kingdom");
  const { ledges, props } = chunkScenery(CITY, CITY.bounds);
  const houses = ledges.filter((l) => l.house);
  const houseTiles = tilesOf(CITY, "house");

  test("every house tile is under exactly one house, and a house is all house tiles", () => {
    for (const { x, z } of houseTiles) assert.equal(houses.filter((h) => inside(h.rect, x, z)).length, 1, `${x}, ${z}`);
    const area = houses.reduce((s, h) => s + h.rect.w * h.rect.h, 0);
    assert.equal(area, houseTiles.length);
  });

  test("a block is cut into houses no longer than a lot, and a one-tile-thick run is a wall with no roof", () => {
    for (const { rect, house } of houses) {
      const long = Math.max(rect.w, rect.h), short = Math.min(rect.w, rect.h);
      if (short === 1) assert.equal(house!.ridge, null);
      else {
        assert.ok(long <= LOT_TILES.deep, JSON.stringify(rect));
        assert.ok(house!.ridge !== null);
      }
    }
    assert.ok(houses.length >= 6);
  });

  test("a house stands taller than its walls, its door on a side facing open ground", () => {
    for (const { rect, topY, house } of houses) {
      if (house!.ridge !== null) assert.ok(topY > house!.wallY);
      if (!house!.door) continue;
      const outside = sideTiles(rect, house!.door);
      assert.ok(outside.some(({ x, z }) => !isSolid(CITY, x, z)), JSON.stringify(rect));
    }
    assert.ok(houses.some((h) => h.house!.door));
  });

  test("houses differ: more than one kind of wall and of roof", () => {
    assert.ok(new Set(houses.map((h) => h.house!.walls)).size > 1);
    assert.ok(new Set(houses.map((h) => h.house!.roof)).size > 1);
  });

  test("a house, a fountain or a plinth cut by a chunk's edge is built once, whole, by the chunk holding its middle", () => {
    const { x, w } = CITY.bounds;
    const chunks = [[0, 6], [6, 9], [9, w]].map(([a, b]) => ({ ...CITY.bounds, x: x + a!, w: b! - a! }));
    const whole = (l: Ledge) => l.look === "house" || l.look === "fountain" || l.look === "plinth";
    const split = chunks.flatMap((c) => chunkScenery(CITY, c).ledges.filter(whole));
    assert.deepEqual(split.map((h) => h.rect).sort(byCorner), ledges.filter(whole).map((h) => h.rect).sort(byCorner));
  });

  test("castle walls are crenellated toward the open air only, not into a hall", () => {
    const walls = ledges.filter((l) => l.look === "castle");
    const crenels = walls.flatMap((l) => crenelsOf(CITY, l.rect));
    assert.ok(crenels.length > 0);
    for (const c of crenels) {
      const out = sideTiles({ x: c.x, z: c.z, w: 1, h: 1 }, c.side)[0]!;
      assert.ok(!isSolid(CITY, out.x, out.z));
      assert.notEqual(tileAt(CITY, out.x, out.z), "marble");
    }
  });

  test("a lone wall tile in a hall is a column", () => {
    const [column] = tilesOf(CITY, "castleWall").filter(({ x, z }) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => !isSolid(CITY, x + dx!, z + dz!)));
    assert.equal(under(ledges, column!.x, column!.z)[0]?.look, "column");
  });

  test("a lamp is a post built on its own tile, its foot on the ground, never a picture", () => {
    const lamps = ledges.filter((l) => l.look === "lamp");
    assert.deepEqual(lamps.map((l) => l.rect).sort(byCorner),
      tilesOf(CITY, "lamp").map(({ x, z }) => ({ x: x - 0.5, z: z - 0.5, w: 1, h: 1 })).sort(byCorner));
    for (const l of lamps) assert.equal(l.topY, 0);
    assert.equal(props.filter((p) => tileAt(CITY, p.x, p.z) === "lamp").length, 0);
  });

  test("the fountain's tiles are one fountain, and a statue stands on its plinth", () => {
    const fountains = new Set(tilesOf(CITY, "fountain").flatMap(({ x, z }) => under(ledges, x, z)));
    assert.equal(fountains.size, 1);
    assert.equal([...fountains][0]!.look, "fountain");
    const statues = props.filter((p) => p.kind === "statue");
    assert.equal(statues.length, 1);
    assert.ok(statues[0]!.y > 0);
    assert.equal(statues[0]!.y, groundY(ledges, statues[0]!.x, statues[0]!.z));
  });
});

describe("Highmere's gates", () => {
  const WALLED = testMap([
    "WWWWWWWWWWWW",
    "W;;;;;;;;;;W",
    "W;;;;;;;;;;W",
    "WWWWW;;WWWWW",
    "WWWWW;;WWWWW",
    "WWWWW;;WWWWW",
    "W;;;;;;;;;;W",
    "WWWWWWWWWWWW",
  ], "kingdom");
  const { ledges } = chunkScenery(WALLED, WALLED.bounds), gates = ledges.filter((l) => l.look === "gate");

  test("a way through the wall gets a gate at each of its mouths, spanning it, taller than the wall", () => {
    assert.deepEqual(gates.map((g) => g.rect).sort(byCorner), [{ x: -1, z: -2, w: 2, h: 1 }, { x: -1, z: 0, w: 2, h: 1 }]);
    const wallY = groundY(ledges, -2.5, -0.5);
    for (const g of gates) assert.ok(g.topY > wallY);
  });

  test("a gate cut by a chunk's edge is built once, by the chunk holding its middle", () => {
    const { x, w } = WALLED.bounds, chunks = [[0, 6], [6, w]].map(([a, b]) => ({ ...WALLED.bounds, x: x + a!, w: b! - a! }));
    const split = chunks.flatMap((c) => chunkScenery(WALLED, c).ledges.filter((l) => l.look === "gate"));
    assert.deepEqual(split.map((g) => g.rect).sort(byCorner), gates.map((g) => g.rect).sort(byCorner));
  });
});

describe("the castle's barracks and kitchen", () => {
  const area = { x: -40, z: -26, w: 80, h: 52 }, rows = Array.from({ length: area.h }, () => [..."+".repeat(area.w)]);
  for (const hall of CASTLE_HALLS) {
    for (let x = hall.x; x < hall.x + hall.w; x++) for (let z = hall.z; z < hall.z + hall.h; z++) rows[area.h / 2 - 1 - z]![x + area.w / 2] = "H";
  }
  const CASTLE = testMap(rows.map((r) => r.join("")), "kingdom", {
    regions: [{ id: "kingdom", name: "Castle", theme: "kingdom", area }],
  });
  const houses = chunkScenery(CASTLE, CASTLE.bounds).ledges.filter((l) => l.house);

  test("each is one building with a look of its own, not a row of town houses", () => {
    for (const hall of CASTLE_HALLS) {
      const built = houses.filter((h) => inside(h.rect, hall.x + 0.5, hall.z + 0.5));
      assert.equal(built.length, 1, hall.use);
      assert.deepEqual(built[0]!.rect, { x: hall.x, z: hall.z, w: hall.w, h: hall.h });
      assert.equal(built[0]!.house!.use, hall.use);
    }
    assert.equal(new Set(CASTLE_HALLS.map((h) => h.use)).size, CASTLE_HALLS.length);
  });

  test("each piece of the keep is built once, whole, by the chunk holding its middle, so no battlement runs along a chunk's edge", () => {
    const reach = { x: -48, z: 16, w: 96, h: 48 }, keep = (c: Rect) => chunkScenery(CASTLE, c).ledges.filter((l) => l.crowned);
    const chunks = Array.from({ length: (reach.w / 16) * (reach.h / 16) }, (_, i) =>
      ({ x: reach.x + (i % (reach.w / 16)) * 16, z: reach.z + Math.floor(i / (reach.w / 16)) * 16, w: 16, h: 16 }));
    const whole = keep(reach).map((l) => l.rect).sort(byCorner);
    assert.ok(whole.some((r) => r.w > 16));
    assert.deepEqual(chunks.flatMap(keep).map((l) => l.rect).sort(byCorner), whole);
  });
});

const byCorner = (a: Rect, b: Rect) => a.x - b.x || a.z - b.z;

function under(ledges: readonly Ledge[], x: number, z: number): Ledge[] {
  return ledges.slice(1).filter((l) => inside(l.rect, x, z));
}

function sideTiles(rect: Rect, side: Side): { x: number; z: number }[] {
  const along = side === "north" || side === "south" ? rect.w : rect.h;
  return Array.from({ length: along }, (_, i) => {
    if (side === "north") return { x: rect.x + i + 0.5, z: rect.z + rect.h + 0.5 };
    if (side === "south") return { x: rect.x + i + 0.5, z: rect.z - 0.5 };
    if (side === "east") return { x: rect.x + rect.w + 0.5, z: rect.z + i + 0.5 };
    return { x: rect.x - 0.5, z: rect.z + i + 0.5 };
  });
}

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

  test("a ledge under half their height, like the fountain's rim, never hides them, however low the camera", () => {
    const rim = { rect: { x: -2, z: 1.6, w: 4, h: 3 }, topY: 0.6, look: "fountain" as const };
    assert.equal(hidesWalker(rim, { x: 0, y: 2, z: 12 }, feet), false);
    assert.equal(hidesWalker(rim, eye, feet), false);
  });

  test("a stall's awning hides them, even over a counter low enough to see over", () => {
    const counter = { ...wall, topY: 1 };
    assert.equal(hidesWalker({ ...counter, awning: { colors: ["#fff", "#000"], topY: 5 } }, eye, feet), true);
  });
});
