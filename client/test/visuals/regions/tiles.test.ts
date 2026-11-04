import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isSolid, tileAt, TILES } from "@infinite-tower/shared";
import { GRASS_FIELD_TILES } from "../../../src/visuals/regions/grass-field/tiles.js";
import { groundKind, tileProps } from "../../../src/visuals/regions/tiles.js";
import { isTall } from "../../../src/visuals/overworld/scenery.js";
import { testMap } from "../../fixtures/map.js";

const MAP = testMap(['TT""', "o~*.", "#_:=", "...."]);
const ALL = MAP.bounds, looks = () => GRASS_FIELD_TILES;
const cell = (x: number, z: number) => `${Math.floor(x)},${Math.floor(z)}`;

describe("tileProps", () => {
  const props = tileProps(MAP, ALL, looks);

  test("each prop stands in a tile whose look has it", () => {
    for (const p of props) {
      const kind = tileAt(MAP, p.x, p.z);
      assert.ok(kind && GRASS_FIELD_TILES[kind].props?.kinds.includes(p.kind), `${p.kind} on ${kind}`);
    }
  });

  test("every solid tile with props shows something standing, so what blocks you can be seen", () => {
    for (const [x, z] of [[-1.5, 1.5], [-0.5, 1.5], [-1.5, 0.5], [-1.5, -0.5]] as const) {
      assert.ok(isSolid(MAP, x, z));
      assert.ok(props.some((p) => isTall(p.kind) && cell(p.x, p.z) === cell(x, z)), `at ${x}, ${z}`);
    }
  });

  test("tall grass gets its tufts", () => {
    const tufts = props.filter((p) => p.kind === "tallGrass");
    assert.equal(tufts.length, 2 * GRASS_FIELD_TILES.tallGrass.props!.count);
  });

  test("a chunk gets just the props of its own tiles, the same as the whole map has there", () => {
    const half = { ...ALL, w: ALL.w / 2 }, inHalf = (p: { x: number }) => p.x < half.x + half.w;
    assert.deepEqual(tileProps(MAP, half, looks), props.filter(inHalf));
  });

  test("the same map always gets the same props", () => {
    assert.deepEqual(tileProps(MAP, ALL, looks), props);
  });

  test("every tile kind has a look", () => {
    for (const kind of Object.keys(TILES)) assert.ok(kind in GRASS_FIELD_TILES, kind);
  });
});

describe("groundKind", () => {
  test("a lamp's tile is painted as the street round it, not a patch of its own", () => {
    const street = testMap([",,,", ",L,", ";,;"], "kingdom");
    assert.equal(tileAt(street, 0, 0), "lamp");
    assert.equal(groundKind(street, -0.5, -0.5), "paving");
    assert.equal(groundKind(street, -1.5, -1.5), "cobbles");
  });
});
