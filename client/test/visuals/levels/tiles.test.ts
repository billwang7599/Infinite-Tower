import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isSolid, tileAt, TILES, type LevelLayout } from "@infinite-tower/shared";
import { GRASS_FIELD_TILES } from "../../../src/visuals/levels/grass-field/tiles.js";
import { tileProps } from "../../../src/visuals/levels/tiles.js";
import { isTall } from "../../../src/visuals/overworld/scenery.js";

const LEVEL: LevelLayout = {
  id: "test", name: "Test", floor: 1, theme: "grass-field", playerSpeed: 5, campfires: [],
  tiles: ['TT""', "o~*.", "#_:="],
};

const cell = (x: number, z: number) => `${Math.floor(x + 2)},${Math.floor(1.5 - z)}`;

describe("tileProps", () => {
  const props = tileProps(LEVEL, GRASS_FIELD_TILES);

  test("each prop stands in a tile whose look has it", () => {
    for (const p of props) {
      const kind = tileAt(LEVEL, p.x, p.z);
      assert.ok(kind && GRASS_FIELD_TILES[kind].props?.kinds.includes(p.kind), `${p.kind} on ${kind}`);
    }
  });

  test("every solid tile with props shows something standing, so what blocks you can be seen", () => {
    for (const [x, z] of [[-1.5, 1], [-0.5, 1], [-1.5, 0], [-1.5, -1]] as const) {
      assert.ok(isSolid(LEVEL, x, z));
      assert.ok(props.some((p) => isTall(p.kind) && cell(p.x, p.z) === cell(x, z)), `at ${x}, ${z}`);
    }
  });

  test("tall grass gets its tufts", () => {
    const tufts = props.filter((p) => p.kind === "tallGrass");
    assert.equal(tufts.length, 2 * GRASS_FIELD_TILES.tallGrass.props!.count);
  });

  test("the same map always gets the same props", () => {
    assert.deepEqual(tileProps(LEVEL, GRASS_FIELD_TILES), props);
  });

  test("every tile kind has a look", () => {
    for (const kind of Object.keys(TILES)) assert.ok(kind in GRASS_FIELD_TILES, kind);
  });
});
