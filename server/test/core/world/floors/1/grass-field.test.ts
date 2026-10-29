import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inTallGrass, isSolid, mapHalfSize, tileAt, WALKER_RADIUS, type Vec2 } from "@infinite-tower/shared";
import { GRASS_FIELD } from "../../../../../src/core/world/floors/1/grass-field.js";

const { layout } = GRASS_FIELD;
const { halfWidth, halfDepth } = mapHalfSize(layout);
const centers = layout.tiles.flatMap((row, r) =>
  [...row].map((_, c) => ({ c, r, x: c - halfWidth + 0.5, z: halfDepth - r - 0.5 })));

function reachableFrom(start: Vec2): Set<string> {
  const key = (c: number, r: number) => `${c},${r}`;
  const first = { c: Math.floor(start.x + halfWidth), r: Math.floor(halfDepth - start.z) };
  const seen = new Set([key(first.c, first.r)]), todo = [first];
  while (todo.length > 0) {
    const { c, r } = todo.pop()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { c: c + dc, r: r + dr };
      if (seen.has(key(n.c, n.r)) || isSolid(layout, n.c - halfWidth + 0.5, halfDepth - n.r - 0.5)) continue;
      seen.add(key(n.c, n.r));
      todo.push(n);
    }
  }
  return seen;
}

const fitsAt = (p: Vec2) => [-1, 1].every((sx) => [-1, 1].every((sz) =>
  !isSolid(layout, p.x + sx * WALKER_RADIUS, p.z + sz * WALKER_RADIUS)));

describe("the Grass Field's map", () => {
  test("is a rectangle of known tiles", () => {
    for (const row of layout.tiles) assert.equal(row.length, layout.tiles[0]!.length);
    for (const t of centers) assert.notEqual(tileAt(layout, t.x, t.z), null, `row ${t.r}, column ${t.c}`);
  });

  test("its edge is solid all round", () => {
    for (const t of centers) {
      const edge = t.r === 0 || t.c === 0 || t.r === layout.tiles.length - 1 || t.c === layout.tiles[0]!.length - 1;
      if (edge) assert.ok(isSolid(layout, t.x, t.z), `row ${t.r}, column ${t.c}`);
    }
  });

  test("has tall grass, and the start isn't in it", () => {
    assert.ok(centers.some((t) => inTallGrass(layout, t.x, t.z)));
    assert.equal(inTallGrass(layout, GRASS_FIELD.spawn.x, GRASS_FIELD.spawn.z), false);
  });

  // The spawner moves a spawn to the other side (x mirrored) when the player stands near it.
  const places: [string, Vec2][] = [
    ["the start", GRASS_FIELD.spawn],
    ...layout.campfires.map((c, i): [string, Vec2] => [`campfire ${i}`, c]),
    ...GRASS_FIELD.spawns.flatMap((s): [string, Vec2][] => [
      [s.enemy, s.at], [`${s.enemy} (mirrored)`, { x: -s.at.x, z: s.at.z }],
    ]),
  ];

  test("the start, the campfires and every spawn stand clear of solid tiles", () => {
    for (const [name, at] of places) assert.ok(fitsAt(at), name);
  });

  test("all of them can be walked to from the start", () => {
    const reached = reachableFrom(GRASS_FIELD.spawn);
    for (const [name, at] of places) {
      const c = Math.floor(at.x + halfWidth), r = Math.floor(halfDepth - at.z);
      assert.ok(reached.has(`${c},${r}`), name);
    }
  });
});
