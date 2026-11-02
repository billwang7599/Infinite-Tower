import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mapHalfSize, tileAt, type LevelLayout, type TileKind } from "@infinite-tower/shared";
import { kingdomScenery } from "../../../../src/visuals/levels/kingdom/scenery.js";
import { groundY } from "../../../../src/visuals/overworld/scenery.js";

const ROWS = [
  "WWWWWWWWWWWWWWWWWWWW",
  "W;;;;;;;;;;;;;;;;;;W",
  "W;;FFFF;;;;PPPP;;;;W",
  "W;;;;;;;;;;;;;;;;;;W",
  "WHHC;;;;;;;;;;;;AHHW",
  "WHHC;;;;;;;;;;;;AHHW",
  "WHHC;;;;;;;;;;;;AHHW",
  "W;;;;;;;;;;;;;;;;;;W",
  "W;;;;;;;;;;;;;;;;;;W",
  "WWWWWWWWWWWWWWWWWWWW",
];
const LEVEL: LevelLayout = {
  id: "test-town", name: "Test Town", theme: "kingdom", playerSpeed: 5, tiles: ROWS, campfires: [], npcs: [], traces: [],
};
const { halfWidth: L, halfDepth: D } = mapHalfSize(LEVEL);
const STALLS: TileKind[] = ["foodStall", "potionStall", "changerStall", "forge"];

function tilesOf(kind: TileKind): { x: number; z: number }[] {
  const at: { x: number; z: number }[] = [];
  for (let x = -L + 0.5; x < L; x++) for (let z = -D + 0.5; z < D; z++) if (tileAt(LEVEL, x, z) === kind) at.push({ x, z });
  return at;
}

describe("Highmere's stalls", () => {
  const scenery = kingdomScenery(LEVEL);
  const standing = scenery.ledges.slice(1);
  const under = (x: number, z: number) =>
    standing.filter((l) => x > l.rect.x && x < l.rect.x + l.rect.w && z > l.rect.z && z < l.rect.z + l.rect.h);

  test("each run of stall tiles is one built stall, so it looks whole from every side", () => {
    for (const kind of STALLS) {
      const tiles = tilesOf(kind);
      assert.ok(tiles.length > 1, kind);
      const runs = new Set(tiles.flatMap(({ x, z }) => under(x, z)));
      assert.equal(runs.size, 1, kind);
      const [run] = runs;
      assert.equal(run!.rect.w * run!.rect.h, tiles.length, kind);
    }
  });

  test("the market stalls have an awning over the counter, the forge doesn't", () => {
    for (const kind of STALLS) {
      const [run] = under(tilesOf(kind)[0]!.x, tilesOf(kind)[0]!.z);
      if (kind === "forge") assert.equal(run!.awning, undefined);
      else assert.ok(run!.awning!.topY > run!.topY, kind);
    }
  });

  test("their goods stand on top of them", () => {
    for (const kind of STALLS) {
      for (const { x, z } of tilesOf(kind)) {
        const goods = scenery.props.filter((p) => Math.floor(p.x) + 0.5 === x && Math.floor(p.z) + 0.5 === z);
        assert.equal(goods.length, 1, `${kind} at ${x}, ${z}`);
        assert.equal(goods[0]!.y, groundY(scenery.ledges, x, z));
        assert.ok(goods[0]!.y > 0);
      }
    }
  });
});
